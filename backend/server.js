const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || "Yahan_Apna_MongoDB_Atlas_Connection_String_Daal_Sakte_Hain";
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let rooms = [];

app.post('/api/create-room', (req, res) => {
  const { roomName, username } = req.body;
  const roomId = 'room_' + Date.now();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newRoom = { roomId, roomName, createdBy: username, roomCode, messages: [] };
  rooms.push(newRoom);
  return res.json({ success: true, room: newRoom });
});

app.post('/api/join-by-code', (req, res) => {
  const { roomCode } = req.body;
  const room = rooms.find(r => r.roomCode && r.roomCode.toUpperCase() === roomCode.trim().toUpperCase());
  if (!room) return res.json({ success: false, message: 'Invalid Room Code!' });
  return res.json({ success: true, room });
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
    const room = rooms.find(r => r.roomId === roomId);
    if (room) {
      socket.emit('load-room-data', { messages: room.messages });
    }
  });

  socket.on('send-message', ({ roomId, message, username }) => {
    const room = rooms.find(r => r.roomId === roomId);
    if (room && message) {
      const msgObj = { username, message };
      room.messages.push(msgObj);
      io.to(roomId).emit('receive-message', msgObj);
    }
  });
});

// --- Serve Frontend in Production ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../', 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));