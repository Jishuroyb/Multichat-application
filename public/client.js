const socket = io();
let currentRoom = '';

setTimeout(() => {
    const username = prompt("Welcome! Please enter your username:");
    if (username) {
        socket.emit('Enter Username', username);
    }
}, 500);

// Helper function to draw a message on the screen
function renderMessage(data) {
    const messagesDiv = document.getElementById('messages');
    const msgElement = document.createElement('div');
    
    msgElement.className = data.type === 'system' ? 'msg system' : 'msg';
    
    let contentHtml = `<span class="meta">[${data.room}] ${data.sender}</span>`;

    if (data.type === 'text' || data.type === 'system') {
        contentHtml += `<span>${data.text}</span>`;
    } else if (data.type === 'image') {
        contentHtml += `<img src="${data.text}" alt="Image">`;
    } else if (data.type === 'video') {
        contentHtml += `<video src="${data.text}" controls></video>`;
    }

    msgElement.innerHTML = contentHtml;
    messagesDiv.appendChild(msgElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; 
}

// 1. Listen for standard incoming messages
socket.on('receive_message', (data) => {
    renderMessage(data);
});

// 2. Listen for the database history when joining a room
socket.on('message_history', (messagesArray) => {
    messagesArray.forEach(data => {
        renderMessage(data);
    });
});

socket.on('privacy_warning', (data) => {
    const userConfirmed = confirm("Warning: Your message seems to contain private information. Send anyway?");
    if (userConfirmed) {
        socket.emit('confirm_send', data); 
    } else {
        renderMessage({ sender: 'System', text: 'Message cancelled to protect privacy.', type: 'system', room: currentRoom });
    }
});

socket.on('triggerButton', () => {
    console.log("Trigger button event received from server.");
});

function joinRoom() {
    // .trim() prevents accidental spaces from messing up the database query
    const room = document.getElementById('roomInput').value.trim(); 
    
    if (room) {
        // Clear the chat UI completely before switching rooms
        document.getElementById('messages').innerHTML = '';
        
        currentRoom = room;
        
        // This single emit will now tell the server to both join AND fetch history
        socket.emit('join_room', room);
    } else {
        alert("Please enter a room name.");
    }
}
function sendText() {
    if (!currentRoom) return alert("Join a room first!");
    const msg = document.getElementById('messageInput').value;
    if (msg) {
        socket.emit('room_message', { roomName: currentRoom, msg: msg, type: 'text' });
        document.getElementById('messageInput').value = '';
    }
}
function fetchHistory() {
    // Make sure they are actually in a room first
    if (!currentRoom) {
        return alert("Please join a room first before loading history!");
    }
    
    // Tell the server to get the messages for the room they are currently in
    console.log(`Requesting history for: ${currentRoom}`);
    socket.emit('request_history', currentRoom);
}

async function uploadAndSendMedia() {
    if (!currentRoom) return alert("Join a room first!");
    
    const fileInput = document.getElementById('mediaInput');
    if (fileInput.files.length === 0) return alert("Please select a file.");

    const formData = new FormData();
    formData.append('media', fileInput.files[0]);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.fileUrl) {
            socket.emit('room_message', { roomName: currentRoom, msg: data.fileUrl, type: data.type });
            fileInput.value = ''; 
        }
    } catch (err) {
        console.error("Upload failed", err);
        alert("File upload failed.");
    }
}