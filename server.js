const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store active users and rooms
const activeUsers = new Map(); // socket.id -> {username, room}
const roomUsers = new Map();   // room -> Set of usernames

// Serve all static files from "public" folder
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Store username when joining
  socket.on("joinRoom", ({ username, room }) => {
    // Leave previous room if any
    if (activeUsers.has(socket.id)) {
      const previousRoom = activeUsers.get(socket.id).room;
      socket.leave(previousRoom);
      
      // Remove user from previous room
      if (roomUsers.has(previousRoom)) {
        roomUsers.get(previousRoom).delete(username);
        if (roomUsers.get(previousRoom).size === 0) {
          roomUsers.delete(previousRoom);
        }
        
        // Notify users in previous room
        io.to(previousRoom).emit("userList", {
          room: previousRoom,
          users: Array.from(roomUsers.get(previousRoom) || [])
        });
      }
    }

    // Join new room
    socket.username = username;
    socket.join(room);
    activeUsers.set(socket.id, { username, room });

    // Add user to room
    if (!roomUsers.has(room)) {
      roomUsers.set(room, new Set());
    }
    roomUsers.get(room).add(username);

    // Send join message if not the default 'public' on first load
    if (room !== "public" || activeUsers.has(socket.id)) {
      io.to(room).emit("chatMessage", {
        user: "System",
        text: `${username} joined ${room}`,
        room,
      });
    }

    // Send updated user list to room
    io.to(room).emit("userList", {
      room,
      users: Array.from(roomUsers.get(room))
    });

    // Send room list to all users
    io.emit("roomList", {
      rooms: Array.from(roomUsers.keys())
    });
  });

  // Handle sending message
  socket.on("chatMessage", ({ room, text }) => {
    io.to(room).emit("chatMessage", {
      user: socket.username || "Anonymous",
      text,
      room,
    });
  });

  // Handle leaving room
  socket.on("leaveRoom", ({ room }) => {
    socket.leave(room);
    
    if (activeUsers.has(socket.id)) {
      const username = activeUsers.get(socket.id).username;
      
      // Remove user from room
      if (roomUsers.has(room)) {
        roomUsers.get(room).delete(username);
        if (roomUsers.get(room).size === 0) {
          roomUsers.delete(room);
        }
        
        // Notify users in room
        io.to(room).emit("userList", {
          room,
          users: Array.from(roomUsers.get(room) || [])
        });
      }
    }
    
    // Send updated room list to all users
    io.emit("roomList", {
      rooms: Array.from(roomUsers.keys())
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    if (activeUsers.has(socket.id)) {
      const { username, room } = activeUsers.get(socket.id);
      activeUsers.delete(socket.id);
      
      // Remove user from room
      if (roomUsers.has(room)) {
        roomUsers.get(room).delete(username);
        if (roomUsers.get(room).size === 0) {
          roomUsers.delete(room);
        }
        
        // Notify users in room
        io.to(room).emit("userList", {
          room,
          users: Array.from(roomUsers.get(room) || [])
        });
        
        // Send leave message
        io.to(room).emit("chatMessage", {
          user: "System",
          text: `${username} left`,
          room,
        });
      }
      
      // Send updated room list to all users
      io.emit("roomList", {
        rooms: Array.from(roomUsers.keys())
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));