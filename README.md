# Multichat Application

A real-time, multi-room chat application built with Node.js, Express, Socket.IO, MongoDB, and Gemini AI.

## Features

- Real-time messaging with Socket.IO
- Multiple chat rooms
- Persistent message history with MongoDB
- Image and video sharing
- Gemini AI checks for potentially harmful or toxic messages
- Privacy warnings for passwords, OTPs, and bank details
- Basic message encryption before text messages are stored
- Responsive browser-based interface

## Technology Stack

- **Backend:** Node.js, Express
- **Real-time communication:** Socket.IO
- **Database:** MongoDB with Mongoose
- **File uploads:** Multer
- **AI safety checks:** Google Gemini API
- **Frontend:** HTML, CSS, and JavaScript

## Requirements

Install the following before running the application:

- Node.js 18 or later
- MongoDB Community Server
- A Google Gemini API key

## Installation

Clone the repository and open the application directory:

```bash
git clone https://github.com/Jishuroyb/Multichat-application.git
cd Multichat-application
```

Install the dependencies:

```bash
npm install
```

## Environment Configuration

Create a file named `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb://localhost:27017/chatapp
PORT=3000
```

Never commit `.env` to GitHub. Keep API keys private.

## Running the Application

Start MongoDB locally, then start the server:

```bash
node server.js
```

Open the application in a browser:

```text
http://localhost:3000
```

Enter a username, provide a room name, and select **Join Room**. To test real-time communication, open the application in two browser tabs or windows.

## Media Uploads

Images and videos are uploaded to `public/uploads/` and shared with users in the current room. This directory is excluded from version control to avoid committing user-generated files.

## Project Structure

```text
chatapp/
├── public/
│   ├── client.js       # Browser-side Socket.IO client
│   ├── index.html      # Chat interface
│   ├── style.css       # Application styling
│   └── uploads/        # Runtime media uploads
├── .env                # Local environment variables
├── package.json        # Dependencies and project metadata
└── server.js           # Express, Socket.IO, MongoDB, and upload server
```

## Security Notes

This project is intended for learning and demonstration. Before using it in production:

- Replace the demo text-shift encryption with established authenticated encryption.
- Add user authentication and authorization.
- Validate file types, file sizes, and uploaded content.
- Restrict room access and protect stored media.
- Store secrets only in environment variables.
- Add rate limiting, input validation, and stronger error handling.

## License

This project is provided for educational purposes.
