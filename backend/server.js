const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cors());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// MongoDB Connection (Using Local MongoDB to avoid network/DNS blocking issues)
const MONGO_URI = "mongodb://localhost:27017/studysync";

mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB Connected Successfully'))
.catch((err) => console.log('MongoDB Connection Error: ', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
    className: { type: String, required: true },
    roomCode: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

// Room-wise files store karne ke liye memory object
const roomFiles = {};

// Auth Routes: Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });
        
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.json({ message: 'Registered successfully', name, email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth Routes: Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });
        res.json({ message: 'Login successful', name: user.name, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Room Routes
app.post('/api/rooms', async (req, res) => {
    try {
        const { className, roomCode, createdBy } = req.body;
        const newRoom = new Room({ className, roomCode, createdBy });
        await newRoom.save();
        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ createdAt: -1 });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File Upload API Route
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ fileUrl, fileName: req.file.originalname });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Socket.io Setup
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', (roomCode) => {
        socket.join(roomCode);
        console.log(`User with ID: ${socket.id} joined room: ${roomCode}`);

        // Jab bhi koi user room join kare, use us room ki purani saari files bhej do
        if (roomFiles[roomCode] && roomFiles[roomCode].length > 0) {
            socket.emit('load_history_files', roomFiles[roomCode]);
        }
    });

    // File upload event handle karna aur room ke baaki users ko broadcast karna
    socket.on('upload_file_event', (data) => {
        const { roomCode, fileData } = data;
        if (!roomFiles[roomCode]) {
            roomFiles[roomCode] = [];
        }
        roomFiles[roomCode].push(fileData);

        // Room ke baaki sabhi users ko real-time file bhejna
        socket.to(roomCode).emit('receive_file', fileData);
    });

    socket.on('send_message', (data) => {
        io.to(data.roomCode).emit('receive_message', data);
    });

    socket.on('drawing', (data) => {
        socket.to(data.roomCode).emit('drawing', data);
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
    });
});

app.get('/', (req, res) => {
    res.send('StudySync Collaborative API is running...');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});