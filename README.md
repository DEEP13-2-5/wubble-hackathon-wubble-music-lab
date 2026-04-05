# 🎶 Wubble Music Lab

A premium, AI-powered music creation and collaboration platform built for the **Wubble Weekend Hackathon**. 

Wubble Music Lab turns your text prompts into studio-quality tracks using the **Wubble AI Engine**, while providing a seamless social and team-based experience for music creators.

## ✨ Features

- **🚀 AI Studio**: Generate high-fidelity music tracks with custom emotions and genres. Support for both Vocal and Instrumental-only tracks.
- **🎤 Synchronized Lyrics**: Automatic extraction and display of AI-generated lyrics for every vocal track.
- **👥 Team Collaboration**: Create teams, invite members via code, and collaborate on "Versions". Vote on your favorite versions and publish the winner to the global feed.
- **🌍 ReelTok World**: A global discovery feed where users can listen, like, dislike, share, and comment on public tracks.
- **🎨 Premium UI/UX**: A dark-mode, glassmorphic interface designed with smooth micro-animations and a persistent global audio player.
- **🔒 Ownership Control**: Full control over your content with the ability to delete your own published tracks.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Vanilla CSS (Custom Glassmorphism)
- **Backend**: Node.js, Express, Socket.io (Real-time collab)
- **Database**: MongoDB (Mongoose)
- **AI Integration**: Wubble API (Music & Lyrics Generation)

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or on Atlas)

### 2. Environment Setup
Create a `.env` file in the `backend` directory based on the provided `.env.example`:
```env
PORT=4000
MONGODB_URI=your_mongodb_uri
WUBBLE_API_KEY=your_wubble_api_key
```

### 3. Installation & Run
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start Backend (Port 4000)
cd backend
npm start

# Start Frontend (Port 5173 / Production)
# For development:
cd frontend
npm run dev

# For production deployment:
cd frontend
npm run build
cd ../backend
npm start
```

---
Built with ❤️ for the Wubble Weekend Hackathon.
