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
const options = {
  muted: false,
  cameraOff: false,
};

async function getMedia(videoId) {
  try {
    const initConstraints = {
      audio: !options.muted,
      video: {
        facingMode: "user",
      },
    };
    const cameraConstraints = {
      audio: !options.muted,
      video: { deviceId: { exact: videoId } },
    }
    myStream = await navigator.mediaDevices.getUserMedia(
      videoId ? cameraConstraints : initConstraints
    );
    myVideo.srcObject = myStream;
    if (!videoId) await getCameras();
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
    if (cameras.length !== 0)
      controlDropdownList.innerHTML = ``;
    cameras.forEach(camera => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.classList.add("dropdown-item");
      button.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        button.classList.add("active");
      }
      button.addEventListener("click", async (event) => {
        await getMedia(camera.deviceId);
        resetCamera();
        if (peerConnection) {
          const videoTrack = myStream.getVideoTracks()[0];
          const videoSender = peerConnection.getSenders()
            .find(sender => sender.track.kind === "video");
          await videoSender.replaceTrack(videoTrack);
        }
        controlDropdownList.querySelectorAll("button").forEach(button => {
          button.classList.remove("active");
        });
        event.target.classList.add("active");
      });
      li.appendChild(button);
      controlDropdownList.appendChild(li);
    });
  } catch (e) {
    console.error(e);
  }
};

// camera & audio toggle
const muteButton = document.getElementById("mute-button");
const cameraButton = document.getElementById("camera-button");

const handleMuteClick = () => {
  if (!options.muted) {
    muteButton.innerText = "Unmute";
    options.muted = true;
  } else {
    muteButton.innerText = "Mute";
    options.muted = false;
  }
  myStream.getAudioTracks()
    .forEach(track => track.enabled = !options.muted);
};

const handleCameraClick = () => {
  if (options.cameraOff) {
    cameraButton.innerText = "Hide Camera"
    options.cameraOff = false;
  } else {
    cameraButton.innerText = "Show Camera";
    options.cameraOff = true;
  }
  myStream.getVideoTracks()
    .forEach(track => track.enabled = !options.cameraOff);
};

const resetCamera = () => {
  myStream.getVideoTracks()
    .forEach(track => track.enabled = !options.cameraOff);
}

muteButton.addEventListener("click", handleMuteClick);
cameraButton.addEventListener("click", handleCameraClick);

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
  dataChannel.addEventListener("message", (event) => {
    displayMessage(peerNickname, event.data, false);
  });
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
    dataChannel.addEventListener("message", (event) => {
      displayMessage(peerNickname, event.data, false);
    });
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
    showTextChatButton();
  });
});

// Host Receives Answer
socket.on("answer", async (answer, peer) => {
  console.log("received answer")
  peerConnection.setRemoteDescription(answer);
  peerNickname = peer;
  shrinkMyVideo();
  showTextChatButton();
});

// Show Text Chat Button
const showTextChatButton = () => {
  document.getElementById("open-text-button").classList.remove("d-none");
}

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

// Text Chat
const chatArea = document.getElementById("chat-offcanvas");
chatArea.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.target.querySelector("input");
  const value = input.value;
  input.value = "";
  if (value === "") return;
  dataChannel.send(value);
  displayMessage("You", value, true);
});

const chatMessageBody = document.getElementById("chat-message-area");
const displayMessage = (nickname, message, me) => {
  const messageDiv = document.createElement("div");
  const nicknameHead = document.createElement("h5");
  const messageContent = document.createElement("p");
  messageDiv.style.maxWidth = "75%";
  nicknameHead.innerText = nickname;
  messageContent.classList.add("rounded", "p-2");
  messageContent.innerText = message;
  if (me) {
    messageDiv.classList.add("align-self-end", "text-end");
    messageContent.classList.add("bg-primary-subtle");
  }
  else {
    messageDiv.classList.add("align-self-start");
    messageContent.classList.add("bg-secondary-subtle");
  }
  messageDiv.appendChild(nicknameHead);
  messageDiv.appendChild(messageContent);

  addMessageAndScroll(messageDiv);
}

const addMessageAndScroll = (element) => {
  chatMessageBody.appendChild(element);
  element.scrollIntoView({ behavior: "smooth", block: "end" });
};


// end call
socket.on("finish", () => {
  alert("call ended.");
  location.reload();
});

// error
socket.on("error", (message) => alert(message));
