const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Store messages in memory
let messages = [];

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route for homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all messages
app.get('/messages', (req, res) => {
  res.json(messages);
});

// Post a new message
app.post('/messages', (req, res) => {
  const { text } = req.body;
  if (text) {
    messages.push(text);
    res.status(201).json({ success: true, messages });
  } else {
    res.status(400).json({ success: false, message: 'No text provided' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});