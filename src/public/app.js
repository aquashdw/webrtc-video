const socket = io();

// procedural divs
const nicknameDiv = document.getElementById("nickname");
const selectHostDiv = document.getElementById("select-host");
const chatRoomDiv = document.getElementById("chat-room");

// Set Nickname
const nicknameForm = nicknameDiv.querySelector("form");
nicknameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = nicknameForm.querySelector("input");
  const value = input.value;
  socket.emit("nickname", input.value, () => {
    nicknameDiv.classList.add("d-none");
    selectHostDiv.classList.remove("d-none");
    document.getElementById("my-nickname").innerText = `${value} (Me)`
  });
  input.value = "";
});

// Become host (create room)
document.getElementById("host-button").addEventListener("click", (event) => {
  socket.emit("create_room", async () => {
    selectHostDiv.classList.add("d-none");
    chatRoomDiv.classList.remove("d-none");
    document.getElementById("select-host-button").parentElement.remove();
    await getMedia();
  });
});

// Become guest (pass to next)
document.getElementById("guest-button").addEventListener("click", async (event) => {
  selectHostDiv.classList.add("d-none");
  chatRoomDiv.classList.remove("d-none");
  await getMedia();
});

// Videos
const myVideoContainer = document.getElementById("my-video-container");
const myVideo = myVideoContainer.querySelector("video");
const peerVideo = document.getElementById("peer-video-container").querySelector("video");

let myStream;
let peerConnection;

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
