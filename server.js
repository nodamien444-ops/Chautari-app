const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve all static files from "public" folder
app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    socket.username = username;
    socket.join(room);

    io.to(room).emit("chatMessage", {
      user: "System",
      text: `${username} joined ${room}`,
      room,
    });
  });

  socket.on("chatMessage", ({ room, text }) => {
    io.to(room).emit("chatMessage", {
      user: socket.username,
      text,
      room,
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("chatMessage", {
        user: "System",
        text: `${socket.username} left`,
        room: "public",
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
