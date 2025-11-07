from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, List, Set
import json
import logging
from datetime import datetime, UTC

from config import settings
from database import get_db, engine, Base, AsyncSessionLocal
from models import Meeting, Participant, MeetingLog
from schemas import (
    MeetingCreate, MeetingResponse, ParticipantJoin, 
    ParticipantResponse, ChatMessage, WSMessageType
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VideoCall API", version="2.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for active WebSocket connections
# Format: {meeting_code: {client_id: websocket}}
active_connections: Dict[str, Dict[str, WebSocket]] = {}

# Store chat messages in memory (for real-time distribution)
# Format: {meeting_code: [messages]}
chat_messages: Dict[str, List[Dict]] = {}


@app.on_event("startup")
async def startup():
    """Create database tables on startup"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")
    logger.info(f"CORS allowed origins: {settings.cors_origins}")


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "2.0",
        "status": "running",
        "active_meetings": len(active_connections),
        "total_participants": sum(len(clients) for clients in active_connections.values())
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(UTC).isoformat()}


# ==================== Meeting Endpoints ====================

@app.post("/api/meetings", response_model=MeetingResponse)
async def create_meeting(
    meeting_data: MeetingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new meeting and return the meeting code"""
    client_ip = request.client.host if request.client else None
    
    meeting = Meeting(
        title=meeting_data.title,
        created_by_ip=client_ip,
        max_participants=meeting_data.max_participants,
        started_at=datetime.now(UTC)
    )
    
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    
    # Initialize chat for this meeting
    chat_messages[meeting.code] = []
    
    logger.info(f"Meeting created: {meeting.code} from IP {client_ip}")
    
    return MeetingResponse(
        id=meeting.id,
        code=meeting.code,
        title=meeting.title,
        created_at=meeting.created_at,
        is_active=meeting.is_active,
        max_participants=meeting.max_participants,
        participant_count=0
    )


@app.get("/api/meetings/{meeting_code}", response_model=MeetingResponse)
async def get_meeting(meeting_code: str, db: AsyncSession = Depends(get_db)):
    """Get meeting details by code"""
    result = await db.execute(
        select(Meeting).where(Meeting.code == meeting_code)
    )
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Count active participants
    participant_count_result = await db.execute(
        select(func.count(Participant.id))
        .where(Participant.meeting_id == meeting.id)
        .where(Participant.is_active == True)
    )
    participant_count = participant_count_result.scalar() or 0
    
    return MeetingResponse(
        id=meeting.id,
        code=meeting.code,
        title=meeting.title,
        created_at=meeting.created_at,
        is_active=meeting.is_active,
        max_participants=meeting.max_participants,
        participant_count=participant_count
    )


@app.get("/api/meetings/{meeting_code}/participants", response_model=List[ParticipantResponse])
async def get_participants(meeting_code: str, db: AsyncSession = Depends(get_db)):
    """Get all active participants in a meeting"""
    result = await db.execute(
        select(Meeting).where(Meeting.code == meeting_code)
    )
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    participants_result = await db.execute(
        select(Participant)
        .where(Participant.meeting_id == meeting.id)
        .where(Participant.is_active == True)
    )
    participants = participants_result.scalars().all()
    
    return [ParticipantResponse.model_validate(p) for p in participants]


# ==================== WebSocket Handler ====================

@app.websocket("/ws/{meeting_code}/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    meeting_code: str,
    client_id: str,
):
    """
    WebSocket endpoint for real-time communication
    Handles: WebRTC signaling, chat messages, participant updates
    """
    await websocket.accept()
    logger.info(f"WebSocket connection: {client_id} joining {meeting_code}")
    
    # Get client IP and user agent
    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent", "Unknown")
    
    # Get or create meeting in database
    async with AsyncSessionLocal() as db:
        try:
            # Find meeting by code
            result = await db.execute(
                select(Meeting).where(Meeting.code == meeting_code)
            )
            meeting = result.scalar_one_or_none()
            
            if not meeting:
                await websocket.close(code=1008, reason="Meeting not found")
                return
            
            # Create participant record
            participant = Participant(
                meeting_id=meeting.id,
                client_id=client_id,
                display_name=None,  # Will be updated when user sends it
                ip_address=client_ip,
                user_agent=user_agent,
                is_active=True,
                is_host=False,  # First participant becomes host
            )
            
            # Check if this is the first participant (make them host)
            existing_participants = await db.execute(
                select(func.count(Participant.id))
                .where(Participant.meeting_id == meeting.id)
                .where(Participant.is_active == True)
            )
            count = existing_participants.scalar() or 0
            if count == 0:
                participant.is_host = True
            
            db.add(participant)
            
            # Log join event
            log_entry = MeetingLog(
                meeting_id=meeting.id,
                participant_id=participant.id,
                event_type="join",
                event_data={"client_id": client_id, "ip": client_ip},
                ip_address=client_ip,
            )
            db.add(log_entry)
            
            await db.commit()
            await db.refresh(participant)
            
            logger.info(f"Participant {client_id} created in database for meeting {meeting_code}")
        except Exception as e:
            logger.error(f"Error creating participant: {e}")
            await db.rollback()
    
    # Initialize meeting connections if not exists
    if meeting_code not in active_connections:
        active_connections[meeting_code] = {}
    
    active_connections[meeting_code][client_id] = websocket
    
    try:
        # Send chat history to newly joined participant
        if meeting_code in chat_messages:
            await websocket.send_json({
                "type": WSMessageType.CHAT_HISTORY,
                "messages": chat_messages[meeting_code]
            })
        
        # Notify others about new participant
        await broadcast_to_meeting(meeting_code, {
            "type": WSMessageType.USER_JOINED,
            "clientId": client_id,
            "timestamp": datetime.now(UTC).isoformat()
        }, exclude_client=client_id)
        
        # Send current participants list to new user
        participant_list = list(active_connections[meeting_code].keys())
        await websocket.send_json({
            "type": WSMessageType.PARTICIPANTS_UPDATE,
            "participants": participant_list
        })
        
        # Main message loop
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            logger.info(f"Message from {client_id}: {message_type}")
            
            # Handle different message types
            if message_type == WSMessageType.OFFER:
                await handle_webrtc_signal(meeting_code, client_id, message)
            
            elif message_type == WSMessageType.ANSWER:
                await handle_webrtc_signal(meeting_code, client_id, message)
            
            elif message_type == WSMessageType.ICE_CANDIDATE:
                await handle_webrtc_signal(meeting_code, client_id, message)
            
            elif message_type == WSMessageType.CHAT_MESSAGE:
                await handle_chat_message(meeting_code, client_id, message)
            
            elif message_type == WSMessageType.JOIN:
                # Update participant display name if provided
                if "displayName" in message:
                    async with AsyncSessionLocal() as db:
                        try:
                            result = await db.execute(
                                select(Participant).where(Participant.client_id == client_id)
                            )
                            participant = result.scalar_one_or_none()
                            if participant:
                                participant.display_name = message["displayName"]
                                await db.commit()
                        except Exception as e:
                            logger.error(f"Error updating participant name: {e}")
                            await db.rollback()
            
            elif message_type == WSMessageType.AUDIO_TOGGLE:
                # Update participant in database
                async with AsyncSessionLocal() as db:
                    try:
                        result = await db.execute(
                            select(Participant).where(Participant.client_id == client_id)
                        )
                        participant = result.scalar_one_or_none()
                        if participant:
                            participant.audio_enabled = message.get("enabled", True)
                            await db.commit()
                            
                            # Log event
                            log_entry = MeetingLog(
                                meeting_id=participant.meeting_id,
                                participant_id=participant.id,
                                event_type="audio_toggle",
                                event_data={"enabled": message.get("enabled", True)},
                            )
                            db.add(log_entry)
                            await db.commit()
                    except Exception as e:
                        logger.error(f"Error updating audio status: {e}")
                        await db.rollback()
                
                await broadcast_to_meeting(meeting_code, {
                    "type": WSMessageType.AUDIO_TOGGLE,
                    "clientId": client_id,
                    "enabled": message.get("enabled", True)
                })
            
            elif message_type == WSMessageType.VIDEO_TOGGLE:
                # Update participant in database
                async with AsyncSessionLocal() as db:
                    try:
                        result = await db.execute(
                            select(Participant).where(Participant.client_id == client_id)
                        )
                        participant = result.scalar_one_or_none()
                        if participant:
                            participant.video_enabled = message.get("enabled", True)
                            await db.commit()
                            
                            # Log event
                            log_entry = MeetingLog(
                                meeting_id=participant.meeting_id,
                                participant_id=participant.id,
                                event_type="video_toggle",
                                event_data={"enabled": message.get("enabled", True)},
                            )
                            db.add(log_entry)
                            await db.commit()
                    except Exception as e:
                        logger.error(f"Error updating video status: {e}")
                        await db.rollback()
                
                await broadcast_to_meeting(meeting_code, {
                    "type": WSMessageType.VIDEO_TOGGLE,
                    "clientId": client_id,
                    "enabled": message.get("enabled", True)
                })
            
            elif message_type == WSMessageType.SCREEN_SHARE_START:
                await broadcast_to_meeting(meeting_code, {
                    "type": WSMessageType.SCREEN_SHARE_START,
                    "clientId": client_id
                }, exclude_client=client_id)
            
            elif message_type == WSMessageType.SCREEN_SHARE_STOP:
                await broadcast_to_meeting(meeting_code, {
                    "type": WSMessageType.SCREEN_SHARE_STOP,
                    "clientId": client_id
                }, exclude_client=client_id)
    
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected from {meeting_code}")
    except Exception as e:
        logger.error(f"Error in WebSocket for {client_id}: {e}")
    finally:
        await handle_disconnect(meeting_code, client_id, client_ip)


async def handle_webrtc_signal(meeting_code: str, from_client: str, message: dict):
    """Forward WebRTC signaling messages to target peer"""
    target_client = message.get("target")
    
    if not target_client:
        logger.warning(f"No target specified for WebRTC signal from {from_client}")
        return
    
    if meeting_code in active_connections and target_client in active_connections[meeting_code]:
        target_ws = active_connections[meeting_code][target_client]
        
        await target_ws.send_json({
            "type": message.get("type"),
            "from": from_client,
            "data": message.get("data")
        })
        logger.info(f"Forwarded {message.get('type')} from {from_client} to {target_client}")


async def handle_chat_message(meeting_code: str, from_client: str, message: dict, db: AsyncSession = None):
    """Handle and broadcast chat messages"""
    chat_data = {
        "type": WSMessageType.CHAT_MESSAGE,
        "from": from_client,
        "message": message.get("message", ""),
        "displayName": message.get("displayName", "Anonymous"),
        "timestamp": datetime.now(UTC).isoformat()
    }
    
    # Store in memory
    if meeting_code not in chat_messages:
        chat_messages[meeting_code] = []
    chat_messages[meeting_code].append(chat_data)
    
    # Log chat message to database
    if db is None:
        async with AsyncSessionLocal() as session:
            try:
                await log_chat_message(meeting_code, from_client, message, session)
            except Exception as e:
                logger.error(f"Error logging chat message: {e}")
    else:
        await log_chat_message(meeting_code, from_client, message, db)
    
    # Broadcast to all participants
    await broadcast_to_meeting(meeting_code, chat_data)
    logger.info(f"Chat message from {from_client} in {meeting_code}")


async def log_chat_message(meeting_code: str, from_client: str, message: dict, db: AsyncSession):
    """Log chat message to database"""
    try:
        # Get meeting
        result = await db.execute(
            select(Meeting).where(Meeting.code == meeting_code)
        )
        meeting = result.scalar_one_or_none()
        if not meeting:
            return
        
        # Get participant
        participant_result = await db.execute(
            select(Participant).where(Participant.client_id == from_client)
        )
        participant = participant_result.scalar_one_or_none()
        
        # Log chat event
        log_entry = MeetingLog(
            meeting_id=meeting.id,
            participant_id=participant.id if participant else None,
            event_type="chat_message",
            event_data={"message": message.get("message", "")},
            ip_address=None,
        )
        db.add(log_entry)
        await db.commit()
    except Exception as e:
        logger.error(f"Error logging chat: {e}")
        await db.rollback()


async def broadcast_to_meeting(meeting_code: str, message: dict, exclude_client: str = None):
    """Broadcast a message to all participants in a meeting"""
    if meeting_code not in active_connections:
        return
    
    for client_id, ws in active_connections[meeting_code].items():
        if exclude_client and client_id == exclude_client:
            continue
        
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.error(f"Error broadcasting to {client_id}: {e}")


async def handle_disconnect(meeting_code: str, client_id: str, client_ip: str = None):
    """Handle client disconnection"""
    # Update participant in database
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Participant).where(Participant.client_id == client_id)
            )
            participant = result.scalar_one_or_none()
            
            if participant:
                participant.is_active = False
                participant.left_at = datetime.now(UTC)
                
                # Log leave event
                log_entry = MeetingLog(
                    meeting_id=participant.meeting_id,
                    participant_id=participant.id,
                    event_type="leave",
                    event_data={"client_id": client_id},
                    ip_address=client_ip,
                )
                db.add(log_entry)
                
                await db.commit()
                logger.info(f"Participant {client_id} marked as inactive in database")
        except Exception as e:
            logger.error(f"Error updating participant on disconnect: {e}")
            await db.rollback()
    
    # Remove from active connections
    if meeting_code in active_connections:
        active_connections[meeting_code].pop(client_id, None)
        
        # If no more participants, clean up meeting
        if not active_connections[meeting_code]:
            active_connections.pop(meeting_code, None)
            # Keep chat history for a bit (could add cleanup logic here)
        else:
            # Notify remaining participants
            await broadcast_to_meeting(meeting_code, {
                "type": WSMessageType.USER_LEFT,
                "clientId": client_id,
                "timestamp": datetime.now(UTC).isoformat()
            })
    
    logger.info(f"Client {client_id} removed from {meeting_code}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)

