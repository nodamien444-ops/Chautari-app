const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Store messages in memory, grouped by room
let rooms = { public: [] };

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route for homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all messages for a room
app.get('/messages/:room', (req, res) => {
  const room = req.params.room || "public";
  res.json(rooms[room] || []);
});

// Post a new message to a room
app.post('/messages/:room', (req, res) => {
  const room = req.params.room || "public";
  const { user, text } = req.body;
  if (!rooms[room]) rooms[room] = [];
  if (text) {
    rooms[room].push({ user, text });
    res.status(201).json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'No text provided' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
