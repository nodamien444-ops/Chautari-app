const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store active users and rooms
const activeUsers = new Map(); // socket.id -> {username, room}
const roomUsers = new Map();   // room -> Set of usernames
const chatHistory = new Map(); // room -> Array of messages


// Store posts data
const posts = []; // Array of post objects
let postIdCounter = 1;

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

    // Initialize chat history for room if it doesn't exist
    if (!chatHistory.has(room)) {
      chatHistory.set(room, []);
    }

    // Send join message if not the default 'public' on first load
    if (room !== "public" || activeUsers.has(socket.id)) {
      const systemMessage = {
        user: "System",
        text: `${username} joined ${room}`,
        room,
        timestamp: new Date().toISOString()
      };
      
      // Add to chat history
      chatHistory.get(room).push(systemMessage);
      
      // Send to all users in the room
      io.to(room).emit("chatMessage", systemMessage);
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

    // Send chat history for this room to the joining user
    socket.emit("chatHistory", {
      room,
      messages: chatHistory.get(room)
    });
  });

  // Handle sending message
  socket.on("chatMessage", ({ room, text }) => {
    const messageData = {
      user: socket.username || "Anonymous",
      text,
      room,
      timestamp: new Date().toISOString()
    };
    
    // Store message in history
    if (!chatHistory.has(room)) {
      chatHistory.set(room, []);
    }
    chatHistory.get(room).push(messageData);
    
    // Send to all users in the room
    io.to(room).emit("chatMessage", messageData);
    
    // Also send to all users who are in other rooms but should see notifications
    // This ensures notifications work across all rooms
    activeUsers.forEach((userData, socketId) => {
      if (userData.room !== room) {
        io.to(socketId).emit("chatMessage", messageData);
      }
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


  // Handle creating a new post
  socket.on("createPost", (data) => {
    const { title, text } = data;
    const username = socket.username;
  
    if (!username || !title.trim() || !text.trim()) return;
  
    const newPost = {
      id: postIdCounter++,
      user: username,
      title: title.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      comments: []
    };
  
    posts.unshift(newPost); // Add to beginning of array
  
    // Broadcast new post to all connected users
    io.emit("newPost", newPost);
  });

  // Handle adding a comment to a post
  socket.on("commentPost", (data) => {
    const { postId, text } = data;
    const username = socket.username;
  
    if (!username || !text.trim()) return;
  
    const post = posts.find(p => p.id === postId);
    if (post) {
      const newComment = {
        id: Date.now(),
        user: username,
        text: text.trim(),
        timestamp: new Date().toISOString()
      };
  
      post.comments.push(newComment);
  
      // Broadcast updated post to all users
      io.emit("updatePost", post);
    }
  });

  // Send current posts to newly connected user
  socket.on("getPosts", () => {
    socket.emit("postsData", posts);
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
        const leaveMessage = {
          user: "System",
          text: `${username} left`,
          room,
          timestamp: new Date().toISOString()
        };
        
        // Add to chat history
        if (chatHistory.has(room)) {
          chatHistory.get(room).push(leaveMessage);
        }
        
        io.to(room).emit("chatMessage", leaveMessage);
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