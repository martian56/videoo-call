# VideoCall Backend

FastAPI backend with async SQLAlchemy, WebSocket support, and comprehensive logging.

## Features

- ✅ **FastAPI** - Modern async web framework
- ✅ **PostgreSQL** - Async database with SQLAlchemy
- ✅ **Alembic** - Database migrations
- ✅ **WebSocket** - Real-time signaling for WebRTC
- ✅ **Database Logging** - Tracks all meetings, participants, and events
- ✅ **IP Tracking** - Logs participant IPs and user agents

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
DEBUG=False
```

### 3. Run Database Migrations

```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions.

### 4. Start the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

**Note:** Use only 1 worker for WebSocket support.

## API Endpoints

### REST API

- `GET /` - Server status
- `GET /health` - Health check
- `POST /api/meetings` - Create a new meeting
- `GET /api/meetings/{code}` - Get meeting details
- `GET /api/meetings/{code}/participants` - Get participants

### WebSocket

- `WS /ws/{meeting_code}/{client_id}` - Real-time communication

## Database Models

### Meeting
- Stores meeting information (code, title, settings)
- Tracks creation IP and timestamps
- Supports up to 10 participants by default

### Participant
- Tracks each participant in a meeting
- Stores IP address, user agent, display name
- Tracks media status (audio/video enabled)
- First participant becomes host

### MeetingLog
- Logs all meeting events:
  - `join` - Participant joined
  - `leave` - Participant left
  - `chat_message` - Chat message sent
  - `audio_toggle` - Audio muted/unmuted
  - `video_toggle` - Video enabled/disabled

## WebSocket Message Types

### Signaling
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate

### Meeting Updates
- `user-joined` - New participant joined
- `user-left` - Participant left
- `participants-update` - Participant list update

### Media Controls
- `audio-toggle` - Audio state changed
- `video-toggle` - Video state changed
- `screen-share-start` - Screen sharing started
- `screen-share-stop` - Screen sharing stopped

### Chat
- `chat-message` - New chat message
- `chat-history` - Chat history on join

## Logging

All events are logged to the database:

- Participant joins/leaves
- Chat messages
- Audio/video toggles
- IP addresses and user agents

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Database Management

```bash
# Create migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Production Deployment

1. Set `DEBUG=False` in `.env`
2. Use proper `SECRET_KEY`
3. Configure `CORS_ORIGINS` with your frontend URL
4. Use SSL/WSS for WebSocket connections
5. Set up proper database connection pooling
6. Use a process manager like systemd or supervisor

## Notes

- WebSocket connections require a single worker
- Database uses async SQLAlchemy for better performance
- All database operations are logged for audit purposes

