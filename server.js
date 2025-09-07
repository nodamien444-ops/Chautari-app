const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

// Keep track of users and rooms
const users = {}; // { socketId: { username, room } }
const rooms = { public: [] }; // { roomName: [username1, username2] }

io.on("connection", (socket) => {

  // Join a room
  socket.on("joinRoom", ({ username, room }) => {
    users[socket.id] = { username, room };

    if (!rooms[room]) rooms[room] = [];
    if (!rooms[room].includes(username)) rooms[room].push(username);

    socket.join(room);

    // Notify room of new user (skip public if first load)
    if (room !== "public") {
      io.to(room).emit("chatMessage", {
        user: "System",
        text: `${username} joined ${room}`,
        room,
      });
    }

    // Update user list in the room
    io.to(room).emit("userList", { users: rooms[room], room });

    // Update room list for all users
    io.emit("roomList", { rooms: Object.keys(rooms) });
  });

  // Leave a room
  socket.on("leaveRoom", ({ room }) => {
    const user = users[socket.id];
    if (!user) return;

    rooms[room] = rooms[room].filter(u => u !== user.username);
    socket.leave(room);

    // Update user list in that room
    io.to(room).emit("userList", { users: rooms[room], room });
  });

  // Chat message
  socket.on("chatMessage", ({ room, text }) => {
    const user = users[socket.id];
    io.to(room).emit("chatMessage", {
      user: user?.username || "Anonymous",
      text,
      room,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    // Remove user from their room
    const { username, room } = user;
    rooms[room] = rooms[room].filter(u => u !== username);

    // Notify others
    io.to(room).emit("userList", { users: rooms[room], room });
    io.emit("chatMessage", {
      user: "System",
      text: `${username} left`,
      room: "public",
    });

    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
