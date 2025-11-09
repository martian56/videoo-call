# LinkUp - Modern Video Meetings Made Simple

LinkUp is a beautiful, modern video calling platform that makes connecting with your team effortless. Whether you're hosting a quick standup or a team meeting, LinkUp provides a smooth, intuitive experience for up to 10 participants.

## ✨ What Makes LinkUp Special

- **Crystal Clear Video Calls** - Connect with up to 10 people in high-quality video meetings
- **Live Chat** - Send messages in real-time during your meetings
- **Screen Sharing** - Share your screen with everyone in the meeting
- **Beautiful Design** - Clean, modern interface that works beautifully on desktop and mobile
- **Keyboard Shortcuts** - Power users will love the quick keyboard controls
- **No Sign-Up Required** - Just create a meeting and share the link - it's that simple!
- **Participant Management** - See who's in the meeting, pin important speakers, and manage your call easily

## 📁 Project Structure

Backend code is organized as follows:

```
backend/
├── src/                          # Source code
│   ├── __init__.py
│   ├── main.py                   # Application entry point
│   │
│   ├── api/                      # API routes and endpoints
│   │   ├── __init__.py
│   │   ├── meetings.py           # Meeting CRUD endpoints
│   │   └── websocket.py          # WebSocket handlers
│   │
│   ├── core/                     # Core functionality
│   │   ├── __init__.py
│   │   ├── config.py             # Configuration and settings
│   │   └── schemas.py            # Pydantic schemas
│   │
│   └── db/                       # Database layer
│       ├── __init__.py
│       ├── database.py           # Database connection
│       └── models.py             # SQLAlchemy models
│
├── tests/                        # Test suite
│   ├── __init__.py
│   ├── conftest.py               # Pytest fixtures
│   ├── test_api.py               # API tests
│   └── test_meetings.py          # Meeting tests
│
├── alembic/                      # Database migrations
│   ├── env.py                    # Alembic environment (updated)
│   └── versions/                 # Migration scripts
│
├── .env                          # Environment variables
├── alembic.ini                   # Alembic configuration
├── requirements.txt              # Python dependencies
└── README.md                     # This file
```

Frontend code is organized as follows:

```
frontend/  # React + TypeScript frontend
    ├── src/
    │   ├── pages/   # Page components
    │   ├── components/ # UI components
    │   ├── hooks/   # Custom hooks
    │   └── api/    # API client
```

## 🛠️ Setting Up LinkUp

Ready to run LinkUp on your machine? Let's get you set up!

### Backend Setup

The backend handles all the meeting logic and WebRTC signaling.

1. **Go to the backend folder:**
   ```bash
   cd backend
   ```

2. **Create a Python virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install all the required packages:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up your environment variables:**
   Create a `.env` file in the `backend` folder:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/videocall
   SECRET_KEY=your-secret-key-here
   CORS_ORIGINS=http://localhost:5173
   ```

5. **Set up the database:**
   ```bash
   alembic init alembic
   # Edit alembic.ini with your DATABASE_URL
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

6. **Start the backend server:**
   ```bash
   python main.py
   ```
   
   You should see the server running on `http://localhost:8000` 🎉

### Frontend Setup

1. **Go to the frontend folder:**
   ```bash
   cd frontend
   ```

2. **Install all the dependencies:**
   ```bash
   npm install
   ```

3. **Configure the API connection:**
   Create a `.env` file in the `frontend` folder:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_WS_URL=ws://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The app will open in your browser at `http://localhost:5173` 🚀

## 🎯 Getting Started

### Creating Your First Meeting

1. Head to the home page and click **"Create Meeting"**
2. You'll get a unique meeting code - share it with your team!
3. You can also copy the meeting link to send via email or chat

### Joining a Meeting

1. Enter the 10-character meeting code (or use a shared link)
2. Type in your name so others know who you are
3. Click **"Join Meeting"** and you're in!

### During the Meeting

- **Mute/Unmute** - Click the microphone button or press `M`
- **Turn Video On/Off** - Click the camera button or press `V`
- **Share Your Screen** - Click the screen share button or press `S`
- **Chat** - Click the chat icon or press `C` to open the chat panel
- **See Participants** - Click the participants icon or press `P` to see who's in the call
- **Pin Someone** - Click the pin icon on any video to focus on them
- **Leave** - Click the red phone button or press `Esc` to leave the meeting

### Keyboard Shortcuts

- `M` - Toggle microphone
- `V` - Toggle camera
- `C` - Toggle chat
- `P` - Toggle participants list
- `S` - Toggle screen sharing
- `Esc` - Close panels or leave meeting
- `?` - Show all keyboard shortcuts

## 🗄️ How It Works

LinkUp uses a simple database to keep track of your meetings:
- **Meetings** - Each meeting gets a unique code and stores basic information
- **Participants** - Tracks who's in each meeting and their preferences
- **Event Logging** - Keeps a record of meeting activities for troubleshooting

## 🔧 Technologies

### Backend
- FastAPI
- SQLAlchemy (async)
- Alembic
- WebSocket
- PostgreSQL

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- WebRTC
- Axios
