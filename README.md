# VideoCall - Modern Group Video Calling Platform

A modern, Google Meet-like video calling application with group video calls (up to 10 people) and live chat functionality.

## 🚀 Features

- **Group Video Calls** - Connect with up to 10 participants simultaneously
- **Live Chat** - Real-time messaging during meetings
- **Modern UI/UX** - Beautiful, responsive design for desktop and mobile
- **WebRTC** - Peer-to-peer video using Google STUN servers
- **Meeting Management** - Create meetings with shareable links
- **Database Logging** - Track meetings, participants, and events
- **IP Tracking** - Log participant IPs and user agents

## 📁 Project Structure

```
video_call/
├── backend/          # FastAPI backend
│   ├── main.py      # Main application
│   ├── models.py    # Database models
│   ├── schemas.py   # Pydantic schemas
│   ├── database.py  # Database setup
│   └── config.py    # Configuration
│
└── frontend/        # React + TypeScript frontend
    ├── src/
    │   ├── pages/   # Page components
    │   ├── components/ # UI components
    │   ├── hooks/   # Custom hooks
    │   └── api/    # API client
```

## 🛠️ Setup

### Backend Setup

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/videocall
   SECRET_KEY=your-secret-key-here
   CORS_ORIGINS=http://localhost:5173
   ```

5. **Run database migrations:**
   ```bash
   alembic init alembic
   # Edit alembic.ini with your DATABASE_URL
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

6. **Start the server:**
   ```bash
   python main.py
   ```

### Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## 🎯 Usage

1. **Create a Meeting:**
   - Go to the home page
   - Click "Create Meeting"
   - Share the meeting code or link with participants

2. **Join a Meeting:**
   - Enter the meeting code
   - Enter your name
   - Click "Join Meeting"

3. **During the Meeting:**
   - Use controls to mute/unmute audio/video
   - Open chat panel to send messages
   - Copy meeting link to invite others

## 🗄️ Database Models

- **Meeting** - Stores meeting information
- **Participant** - Tracks meeting participants
- **MeetingLog** - Logs all meeting events

## 🔧 Technologies

### Backend
- FastAPI
- SQLAlchemy (async)
- Alembic
- WebSocket
- PostgreSQL (via Neon.tech)

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- WebRTC
- Axios

## 📝 API Endpoints

- `POST /api/meetings` - Create a new meeting
- `GET /api/meetings/{code}` - Get meeting details
- `GET /api/meetings/{code}/participants` - Get participants
- `WS /ws/{meeting_code}/{client_id}` - WebSocket connection

## 🚀 Deployment

### Backend
- Set up PostgreSQL database (Neon.tech recommended)
- Configure environment variables
- Run migrations
- Deploy with uvicorn (single worker for WebSocket)

### Frontend
- Build: `npm run build`
- Deploy `dist/` folder to your hosting service
- Configure environment variables for API URLs

## 📄 License

MIT License
