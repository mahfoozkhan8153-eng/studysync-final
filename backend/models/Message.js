const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomCode: { type: String, required: true },
    sender: { type: String, required: true },
    message: { type: String },
    fileUrl: { type: String }, // File upload hone par uska path ya URL yahan save hoga
    fileName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);