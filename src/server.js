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



const handleListen = () => console.log("Listening on http://127.0.0.1:3000")
httpServer.listen(3000, handleListen);
