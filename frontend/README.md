# VideoCall Frontend

Modern React + TypeScript frontend for group video calling with live chat.

## Features

- 🎥 **Group Video Calls** - Up to 10 participants
- 💬 **Live Chat** - Real-time messaging during meetings
- 📱 **Responsive Design** - Works on desktop and mobile
- 🎨 **Modern UI** - Beautiful, intuitive interface
- 🔒 **Secure** - WebRTC with STUN servers

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create a `.env` file:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
frontend/
├── src/
│   ├── api/          # API client functions
│   ├── components/   # React components
│   │   ├── VideoGrid.tsx
│   │   ├── ChatPanel.tsx
│   │   └── MeetingControls.tsx
│   ├── hooks/       # Custom React hooks
│   │   ├── useWebSocket.ts
│   │   └── useWebRTC.ts
│   ├── pages/        # Page components
│   │   ├── Home.tsx
│   │   ├── JoinMeeting.tsx
│   │   └── MeetingRoom.tsx
│   ├── utils/        # Utility functions
│   ├── App.tsx       # Main app component
│   ├── main.tsx      # Entry point
│   └── index.css     # Global styles
```

## Usage

1. **Create a meeting** - Click "Create Meeting" on the home page
2. **Join a meeting** - Enter a meeting code or use the shareable link
3. **Video controls** - Use the bottom controls to mute/unmute audio/video
4. **Chat** - Click the chat icon to open the chat panel
5. **Share** - Click the copy icon to share the meeting link

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **WebRTC** - Peer-to-peer video
- **WebSocket** - Real-time signaling
