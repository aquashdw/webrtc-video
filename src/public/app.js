const socket = io();

// procedural divs
const nicknameDiv = document.getElementById("nickname");
const selectHostDiv = document.getElementById("select-host");
const chatRoomDiv = document.getElementById("chat-room");

// global vars
let room;
let myNickname;
let peerNickname;

// Set Nickname
const nicknameForm = nicknameDiv.querySelector("form");
nicknameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = nicknameForm.querySelector("input");
  const value = input.value;
  socket.emit("nickname", value, () => {
    myNickname = value;
    nicknameDiv.classList.add("d-none");
    selectHostDiv.classList.remove("d-none");
    document.getElementById("my-nickname").innerText = `${myNickname} (Me)`
  });
  input.value = "";
});

// Become host (create room)
document.getElementById("host-button").addEventListener("click", (event) => {
  socket.emit("create_room", async () => {
    room = myNickname;
    selectHostDiv.classList.add("d-none");
    chatRoomDiv.classList.remove("d-none");
    document.getElementById("select-host-button").parentElement.remove();
    await getMedia();
    makeConnection();
  });
});

// Become guest (pass to next)
document.getElementById("guest-button").addEventListener("click", async (event) => {
  selectHostDiv.classList.add("d-none");
  chatRoomDiv.classList.remove("d-none");
  await getMedia();
  makeConnection();
});

// Videos
const myVideoContainer = document.getElementById("my-video-container");
const myVideo = myVideoContainer.querySelector("video");
const peerVideo = document.getElementById("peer-video-container").querySelector("video");

let myStream;
let peerConnection;
let dataChannel;

async function getMedia(videoId) {
  try {
    const initConstraints = {
      audio: {
        muted: true,
      },
      video: {
        facingMode: "user",
      },
    };
    const cameraConstraints = {
      video: { deviceId: { exact: videoId } },
    }
    myStream = await navigator.mediaDevices.getUserMedia(
      videoId ? cameraConstraints : initConstraints
    );
    myVideo.srcObject = myStream;
    await getCameras();
  } catch (e) {
    console.log(e);
  }
}

const getCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    const controlDropdownList = document.getElementById("controls").querySelector("ul.dropdown-menu");
    controlDropdownList.innerHTML = ``;
    cameras.forEach(camera => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.classList.add("dropdown-item");
      button.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        button.classList.add("active");
      }
      button.addEventListener("click", async () => {
        await getMedia(camera.deviceId);
        if (peerConnection) {
          const videoTrack = myStream.getVideoTracks()[0];
          const videoSender = peerConnection.getSenders()
            .find(sender => sender.track.kind === "video");
          await videoSender.replaceTrack(videoTrack);
        }
      });
      li.appendChild(button);
      controlDropdownList.appendChild(li);
    })
  } catch (e) {
    console.error(e);
  }
};

// Load Rooms (available users)
const selectHostModal = document.getElementById("select-host-modal");
socket.on("rooms", (roomInfoList) => {
  const roomUl= selectHostModal.querySelector("ul");
  roomUl.innerHTML = ``;
  if (roomInfoList.length === 0) {
    const noRoomLi = document.createElement("li");
    noRoomLi.innerText = "No Rooms Yet";
    noRoomLi.classList.add("list-group-item", "disabled");
    roomUl.appendChild(noRoomLi);
    return;
  }
  roomInfoList.forEach(roomInfo => {
    const roomButton = document.createElement("button");
    roomButton.innerText = roomInfo.room;
    roomButton.classList.add("list-group-item", "list-group-item-action");
    if (roomInfo.busy) {
      roomButton.innerText += " (Busy)";
      roomButton.disabled = true;
    }
    roomUl.appendChild(roomButton);
    roomButton.addEventListener("click", (event) => {
      room = event.target.innerText;
      socket.emit("join_room", room, () => {
        selectHostModal.querySelector("button.btn-close").click();
      });
    })
  });
});

// Start Connection
const handleIce = (data) => {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, room);
};

const handleAddStream = (data) => {
  peerVideo.srcObject = data.stream;
};

const makeConnection = () => {
  peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
        ],
      },
    ],
  });
  peerConnection.addEventListener("icecandidate", handleIce);
  peerConnection.addEventListener("addstream", handleAddStream);
  myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));
}

// Guest Joins Host
socket.on("joined", async () => {
  dataChannel = peerConnection.createDataChannel("chat");
  dataChannel.addEventListener("message", (event) => console.log(event.data));
  console.log("made data channel");
  const offer = await peerConnection.createOffer();
  peerConnection.setLocalDescription(offer);
  console.log("send offer");
  socket.emit("offer", offer, room);
});

// Guest Receives Offer
socket.on("offer", async (offer) => {
  peerConnection.addEventListener("datachannel", (event) => {
    dataChannel = event.channel;
    dataChannel.addEventListener("message", console.log);
  });
  console.log("received offer");
  peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  peerConnection.setLocalDescription(answer);
  console.log("send answer");
  socket.emit("answer", answer, room, () => {
    document.getElementById("select-host-button").parentElement.remove();
    peerNickname = room;
    shrinkMyVideo();
  });
});

// Host Receives Answer
socket.on("answer", async (answer, peer) => {
  console.log("received answer")
  peerConnection.setRemoteDescription(answer);
  peerNickname = peer;
  shrinkMyVideo();
});

// Set My Video Smaller
const shrinkMyVideo = () => {
  document.getElementById("peer-nickname").innerText = peerNickname;
  myVideo.width = 120;
  myVideo.height = 80;
  myVideoContainer.style.bottom = "40px";
  myVideoContainer.style.left = "60px";
  const meLabel = document.createElement("h5");
  meLabel.classList.add("text-center", "text-light");
  meLabel.innerText = "Me";
  myVideoContainer.appendChild(meLabel);
}

// ICE
socket.on("ice", (ice) => {
  console.log("received candidate");
  peerConnection.addIceCandidate(ice);
});


// camera & audio toggle
const muteButton = document.getElementById("mute-button");
const cameraButton = document.getElementById("camera-button");
const options = {
  muted: false,
  cameraOff: false,
};

const handleMuteClick = () => {
  myStream.getAudioTracks()
    .forEach(track => track.enabled = !track.enabled);
  if (!options.muted) {
    muteButton.innerText = "Unmute";
    options.muted = true;
  } else {
    muteButton.innerText = "Mute";
    options.muted = false;
  }
};

const handleCameraClick = () => {
  myStream.getVideoTracks()
    .forEach(track => track.enabled = !track.enabled);
  if (options.cameraOff) {
    cameraButton.innerText = "Hide Camera"
    options.cameraOff = false;
  } else {
    cameraButton.innerText = "Show Camera";
    options.cameraOff = true;
  }
};

muteButton.addEventListener("click", handleMuteClick);
cameraButton.addEventListener("click", handleCameraClick);

// end call
socket.on("finish", () => {
  alert("call ended.");
  location.reload();
});

// error
socket.on("error", (message) => alert(message));
