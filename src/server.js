import express from "express";
import { Server } from "socket.io";

import http from "http";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app)
const io = new Server(httpServer);

// collect room info
const countRoom = (roomName) => {
  const rooms = io.sockets.adapter.rooms;
  return rooms.get(roomName)?.size;
};

const getRoomList = () => {
  const roomInfoList = [];
  const {sids, rooms} = io.sockets.adapter;
  rooms.forEach((_, room) => {
    if (sids.get(room) === undefined) roomInfoList.push({
      room, users: countRoom(room),
    })
  });
  return roomInfoList;
}

io.on("connection", (socket) => {
  socket.emit("rooms", getRoomList());
  socket.on("nickname", (nickname, done) => {
    socket.nickname = nickname;
    done();
  });

  socket.on("create_room", (done) => {
    socket.join(socket.nickname);
    io.sockets.emit("rooms", getRoomList());
    done();
  });
});

const handleListen = () => console.log("Listening on http://127.0.0.1:3000")
httpServer.listen(3000, handleListen);
