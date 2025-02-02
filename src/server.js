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
      room, busy: busyRooms.has(room),
    })
  });
  return roomInfoList;
}

const usedNicknames = new Set();
const busyRooms = new Set();

io.on("connection", (socket) => {
  socket.emit("rooms", getRoomList());
  socket.on("nickname", (nickname, done) => {
    if (usedNicknames.has(nickname)) {
      socket.emit("error", "nickname in use");
      return;
    }
    usedNicknames.add(nickname);
    socket.nickname = nickname;
    done();
  });

  socket.on("create_room", (done) => {
    socket.join(socket.nickname);
    io.sockets.emit("rooms", getRoomList());
    done();
  });

  socket.on("join_room", (room, done) => {
    const target = getRoomList().find(roomInfo => roomInfo.room === room);
    if (!target) {
      socket.emit("error", "Room Disappeared!!!");
      return;
    }
    if (target.busy) {
      socket.emit("error", "A Chat already Started");
      return;
    }
    socket.join(room);
    socket.to(room).emit("joined");
    busyRooms.add(room);
    done();
  });

  socket.on("offer", (offer, room) => {
    socket.to(room).emit("offer", offer);
  });

  socket.on("answer", (answer, room, done) => {
    socket.to(room).emit("answer", answer, socket.nickname);
    done();
  });

  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
    io.sockets.emit("rooms", getRoomList());
  })

  socket.on("disconnecting", () => {
    usedNicknames.delete(socket.nickname);
    socket.rooms.forEach(room => {
      busyRooms.delete(room);
      socket.to(room).emit("finish");
    });
    io.sockets.emit("rooms", getRoomList());
  });

  socket.on("disconnect", () => {
    io.sockets.emit("rooms", getRoomList());
  });
});

const handleListen = () => console.log("Listening on http://127.0.0.1:3000")
httpServer.listen(3000, handleListen);
