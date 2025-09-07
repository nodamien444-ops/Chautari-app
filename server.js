const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve all static files from "public" folder
app.use(express.static("public"));

io.on("connection", (socket) => {
  // Store username when joining
  socket.on("joinRoom", ({ username, room }) => {
    socket.username = username;
    socket.join(room);

    // Only send join message if not the default 'public' on first load
    if(room !== "public") {
      io.to(room).emit("chatMessage", {
        user: "System",
        text: `${username} joined ${room}`,
        room,
      });
    }
  });

  // Handle sending message
  socket.on("chatMessage", ({ room, text }) => {
    io.to(room).emit("chatMessage", {
      user: socket.username || "Anonymous",
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