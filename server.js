const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);


const ASCII_SHIFT_KEY = 3; 

function encryptText(plainText) {
    if (!plainText) return plainText;
    let encrypted = "";
    for (let i = 0; i < plainText.length; i++) {
        encrypted += String.fromCharCode(plainText.charCodeAt(i) + ASCII_SHIFT_KEY);
    }
    return encrypted;
}

function decryptText(encryptedText) {
    if (!encryptedText) return encryptedText;
    let decrypted = "";
    for (let i = 0; i < encryptedText.length; i++) {
        decrypted += String.fromCharCode(encryptedText.charCodeAt(i) - ASCII_SHIFT_KEY);
    }
    return decrypted;
}

// --- 2. MongoDB Database Setup ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(' Connected to MongoDB successfully'))
  .catch((err) => console.error(' MongoDB connection error:', err));

const messageSchema = new mongoose.Schema({
    sender: String,
    text: String,
    type: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// --- 3. AI Configuration ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkForTrolling(message) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    const prompt = `Analyze this chat message for trolling or toxicity. 
    If it IS trolling, reply ONLY with a short, soothing, empathetic message to ease their mental state. 
    If it is a normal or benign message, reply ONLY with the exact word "SAFE".
    Message: "${message}"`;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini API Error (Troll Check):", error);
        return "SAFE"; 
    }
}

async function checkForSensitiveInfo(message) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    const prompt = `Analyze this chat message. Does it contain highly sensitive private information like passwords, OTPs (One Time Passwords), or bank details? 
    If yes, reply ONLY with the exact word "CONFIRM". 
    If it is safe to share, reply ONLY with the exact word "SAFE".
    Message: "${message}"`;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini API Error (Privacy Check):", error);
        return "SAFE"; 
    }
}

// --- 4. Multer Configuration (File Storage) ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));

app.post('/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const type = ['.mp4', '.webm', '.ogg'].includes(ext) ? 'video' : 'image';
    res.json({ fileUrl: `/uploads/${req.file.filename}`, type: type });
});

// --- 5. Socket.IO Configuration ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('Enter Username', (username) => {
        socket.username = username;
    });

    socket.on('join_room', async (roomName) => {
        socket.join(roomName);
        socket.emit('receive_message', { sender: 'System', text: `Joined ${roomName}`, type: 'system', room: roomName });

        try {
            // DATABASE FETCH: Get old messages for this room
            const messages = await Message.find({ room: roomName }).sort({ timestamp: 1 });
            console.log(`[DATABASE] Fetched ${messages.length} old messages for room: ${roomName}`);
            
            if (messages.length > 0) {
                // DECRYPT the text before sending it to the client
                const decryptedMessages = messages.map(msgDoc => {
                    return {
                        sender: msgDoc.sender,
                        text: msgDoc.type === 'text' ? decryptText(msgDoc.text) : msgDoc.text,
                        type: msgDoc.type,
                        room: msgDoc.room
                    };
                });
                socket.emit('message_history', decryptedMessages);
            }
        } catch (error) {
            console.error("Error fetching message history:", error);
        }
    });

    socket.on('room_message', async (data) => {
        const { roomName, msg, type } = data; 
        const senderName = socket.username || socket.id; 

        if (type === 'text') {
             // AI checks run on the PLAIN text 'msg'
             const privacyStatus = await checkForSensitiveInfo(msg);
             if (privacyStatus === "CONFIRM") {
                 socket.emit('privacy_warning', { roomName, msg, type });
                 setTimeout(() => { socket.emit('triggerButton'); }, 3000);
                 return; 
             }

             const aiResponse = await checkForTrolling(msg);
             if (aiResponse !== "SAFE") {
                 socket.emit('receive_message', { sender: 'AI Moderator', text: aiResponse, type: 'system', room: roomName });
                 return; 
             }
        }

        // 1. Broadcast the PLAIN text to active users
        const broadcastData = { sender: senderName, text: msg, type: type || 'text', room: roomName };
        io.to(roomName).emit('receive_message', broadcastData);

        // 2. ENCRYPT and save to Database
        try {
            const dbData = { 
                sender: senderName, 
                text: type === 'text' ? encryptText(msg) : msg, // Only encrypt if it's text (not a file URL)
                type: type || 'text', 
                room: roomName 
            };
            await Message.create(dbData);
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    socket.on('confirm_send', async (data) => {
        const { roomName, msg, type } = data;
        const senderName = socket.username || socket.id;

        const aiResponse = await checkForTrolling(msg);
        if (aiResponse !== "SAFE") {
            socket.emit('receive_message', { sender: 'AI Moderator', text: aiResponse, type: 'system', room: roomName });
            return; 
        }

        // 1. Broadcast the PLAIN text
        const broadcastData = { sender: senderName, text: msg, type: type, room: roomName };
        io.to(roomName).emit('receive_message', broadcastData);
        
        // 2. ENCRYPT and save bypassed message to Database
        try {
            const dbData = { 
                sender: senderName, 
                text: type === 'text' ? encryptText(msg) : msg, 
                type: type || 'text', 
                room: roomName 
            };
            await Message.create(dbData);
        } catch (error) {
            console.error("Error saving bypassed message:", error);
        }
     });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});