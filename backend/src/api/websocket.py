from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List
import json
import logging
from datetime import datetime, UTC

from src.db.database import AsyncSessionLocal
from src.db.models import Meeting, Participant, MeetingLog
from src.core.schemas import WSMessageType

logger = logging.getLogger(__name__)

# In-memory storage for active WebSocket connections
# Format: {meeting_code: {client_id: websocket}}
active_connections: Dict[str, Dict[str, WebSocket]] = {}

# Store chat messages in memory (for real-time distribution)
# Format: {meeting_code: [messages]}
chat_messages: Dict[str, List[Dict]] = {}


async def handle_websocket(
    websocket: WebSocket,
    meeting_code: str,
    client_id: str,
):
    """
    WebSocket handler for real-time communication
    Handles: WebRTC signaling, chat messages, participant updates
    """
    await websocket.accept()
    logger.info(f"WebSocket connection: {client_id} joining {meeting_code}")
    
    # Get client IP and user agent
    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent", "Unknown")
    
    # Get or create meeting in database
    meeting = None
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
            
            # Check if this is the first active participant (make them host)
            existing_participants = await db.execute(
                select(func.count(Participant.id))
                .where(Participant.meeting_id == meeting.id)
                .where(Participant.is_active == True)
            )
            count = existing_participants.scalar() or 0
            is_host = count == 0
            
            # Create participant record
            participant = Participant(
                meeting_id=meeting.id,
                client_id=client_id,
                display_name=None,  # Will be updated when user sends it
                ip_address=client_ip,
                user_agent=user_agent,
                is_active=True,
                is_host=is_host,
            )
            
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
            
            logger.info(f"Participant {client_id} created in database for meeting {meeting_code} (host: {is_host})")
        except Exception as e:
            logger.error(f"Error creating participant: {e}")
            await db.rollback()
            await websocket.close(code=1011, reason="Internal server error")
            return
    
    # Ensure meeting was found before proceeding
    if not meeting:
        return
    
    # Initialize meeting connections if not exists
    if meeting_code not in active_connections:
        active_connections[meeting_code] = {}
    
    active_connections[meeting_code][client_id] = websocket
    
    # Initialize chat messages for meeting
    if meeting_code not in chat_messages:
        chat_messages[meeting_code] = []
    
    try:
        # Send chat history to newly joined participant
        if meeting_code in chat_messages:
            await websocket.send_json({
                "type": WSMessageType.CHAT_HISTORY,
                "messages": chat_messages[meeting_code]
            })
        
        # Notify others about new participant
        display_name = None
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(
                    select(Participant).where(Participant.client_id == client_id)
                )
                participant = result.scalar_one_or_none()
                if participant:
                    display_name = participant.display_name
            except Exception as e:
                logger.error(f"Error getting participant display name: {e}")
        
        await broadcast_to_meeting(meeting_code, {
            "type": WSMessageType.USER_JOINED,
            "clientId": client_id,
            "displayName": display_name,
            "timestamp": datetime.now(UTC).isoformat()
        }, exclude_client=client_id)
        
        # Send current participants list to new user
        await send_participants_update(websocket, meeting_code, meeting.id)
        
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
                await handle_join_message(meeting_code, client_id, message)
            
            elif message_type == WSMessageType.AUDIO_TOGGLE:
                await handle_media_toggle(meeting_code, client_id, message, "audio")
            
            elif message_type == WSMessageType.VIDEO_TOGGLE:
                await handle_media_toggle(meeting_code, client_id, message, "video")
            
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


async def send_participants_update(websocket: WebSocket, meeting_code: str, meeting_id: str):
    """Send current participants list to a specific client"""
    participant_list = list(active_connections.get(meeting_code, {}).keys())
    
    participants_data = []
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Participant).where(
                    Participant.meeting_id == meeting_id,
                    Participant.is_active == True
                )
            )
            db_participants = result.scalars().all()
            for p in db_participants:
                if p.client_id in participant_list:
                    participants_data.append({
                        "clientId": p.client_id,
                        "displayName": p.display_name,
                        "audioEnabled": p.audio_enabled,
                        "videoEnabled": p.video_enabled,
                        "screenSharing": p.screen_sharing
                    })
        except Exception as e:
            logger.error(f"Error fetching participant data: {e}")
            participants_data = [{"clientId": cid} for cid in participant_list]
    
    await websocket.send_json({
        "type": WSMessageType.PARTICIPANTS_UPDATE,
        "participants": participant_list,
        "participantsData": participants_data
    })


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


async def handle_chat_message(meeting_code: str, from_client: str, message: dict):
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
    async with AsyncSessionLocal() as db:
        try:
            await log_chat_message(meeting_code, from_client, message, db)
        except Exception as e:
            logger.error(f"Error logging chat message: {e}")
    
    # Broadcast to all participants
    await broadcast_to_meeting(meeting_code, chat_data)
    logger.info(f"Chat message from {from_client} in {meeting_code}")


async def log_chat_message(meeting_code: str, from_client: str, message: dict, db: AsyncSession):
    """Log chat message to database"""
    try:
        result = await db.execute(
            select(Meeting).where(Meeting.code == meeting_code)
        )
        meeting = result.scalar_one_or_none()
        if not meeting:
            return
        
        participant_result = await db.execute(
            select(Participant).where(Participant.client_id == from_client)
        )
        participant = participant_result.scalar_one_or_none()
        
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


async def handle_join_message(meeting_code: str, client_id: str, message: dict):
    """Handle join message with display name"""
    if "displayName" in message:
        display_name = message["displayName"]
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(
                    select(Participant).where(Participant.client_id == client_id)
                )
                participant = result.scalar_one_or_none()
                if participant:
                    participant.display_name = display_name
                    await db.commit()
                    logger.info(f"Updated display name for {client_id}: {display_name}")
            except Exception as e:
                logger.error(f"Error updating participant name: {e}")
                await db.rollback()
        
        # Broadcast display name update
        await broadcast_to_meeting(meeting_code, {
            "type": "participant-name-update",
            "clientId": client_id,
            "displayName": display_name
        }, exclude_client=client_id)


async def handle_media_toggle(meeting_code: str, client_id: str, message: dict, media_type: str):
    """Handle audio/video toggle events"""
    enabled = message.get("enabled", True)
    
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Participant).where(Participant.client_id == client_id)
            )
            participant = result.scalar_one_or_none()
            if participant:
                if media_type == "audio":
                    participant.audio_enabled = enabled
                else:
                    participant.video_enabled = enabled
                await db.commit()
                
                log_entry = MeetingLog(
                    meeting_id=participant.meeting_id,
                    participant_id=participant.id,
                    event_type=f"{media_type}_toggle",
                    event_data={"enabled": enabled},
                )
                db.add(log_entry)
                await db.commit()
        except Exception as e:
            logger.error(f"Error updating {media_type} status: {e}")
            await db.rollback()
    
    message_type = WSMessageType.AUDIO_TOGGLE if media_type == "audio" else WSMessageType.VIDEO_TOGGLE
    await broadcast_to_meeting(meeting_code, {
        "type": message_type,
        "clientId": client_id,
        "enabled": enabled
    })


async def broadcast_to_meeting(meeting_code: str, message: dict, exclude_client: str = None):
    """Broadcast a message to all participants in a meeting"""
    if meeting_code not in active_connections:
        return
    
    connections = list(active_connections[meeting_code].items())
    
    for client_id, ws in connections:
        if exclude_client and client_id == exclude_client:
            continue
        
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.error(f"Error broadcasting to {client_id}: {e}")
            if meeting_code in active_connections:
                active_connections[meeting_code].pop(client_id, None)


async def handle_disconnect(meeting_code: str, client_id: str, client_ip: str = None):
    """Handle client disconnection"""
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Participant).where(Participant.client_id == client_id)
            )
            participant = result.scalar_one_or_none()
            
            if participant:
                participant.is_active = False
                participant.left_at = datetime.now(UTC)
                
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
    
    if meeting_code in active_connections:
        active_connections[meeting_code].pop(client_id, None)
        
        if not active_connections[meeting_code]:
            active_connections.pop(meeting_code, None)
        else:
            await broadcast_to_meeting(meeting_code, {
                "type": WSMessageType.USER_LEFT,
                "clientId": client_id,
                "timestamp": datetime.now(UTC).isoformat()
            })
    
    logger.info(f"Client {client_id} removed from {meeting_code}")
