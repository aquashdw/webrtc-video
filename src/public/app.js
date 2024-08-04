const socket = io();

// procedural divs
const nicknameDiv = document.getElementById("nickname");
const selectHostDiv = document.getElementById("select-host");
const chatRoomDiv = document.getElementById("chat-room");

// Set Nickname
const nicknameForm = nicknameDiv.querySelector("form");
nicknameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = nicknameForm.querySelector("input")
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
  socket.emit("create_room", () => {
    selectHostDiv.classList.add("d-none");
    chatRoomDiv.classList.remove("d-none");
    document.getElementById("select-host-button").parentElement.remove();
  });
});
// Become guest (pass to next)
document.getElementById("guest-button").addEventListener("click", (event) => {
  selectHostDiv.classList.add("d-none");
  chatRoomDiv.classList.remove("d-none");
});
