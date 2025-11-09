from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any


class MeetingCreate(BaseModel):
    title: Optional[str] = None
    max_participants: int = Field(default=10, ge=2, le=50)


class MeetingResponse(BaseModel):
    id: str
    code: str
    title: Optional[str]
    created_at: datetime
    is_active: bool
    max_participants: int
    participant_count: int = 0
    
    class Config:
        from_attributes = True


class ParticipantJoin(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    meeting_code: str = Field(min_length=10, max_length=10)


class ParticipantResponse(BaseModel):
    id: str
    client_id: str
    display_name: Optional[str]
    joined_at: datetime
    is_active: bool
    is_host: bool
    audio_enabled: bool
    video_enabled: bool
    screen_sharing: bool
    
    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    timestamp: Optional[datetime] = None


class WebSocketMessage(BaseModel):
    type: str
    data: Optional[Dict[str, Any]] = None
    from_client: Optional[str] = None
    to_client: Optional[str] = None
    target: Optional[str] = None


# WebSocket message types
class WSMessageType:
    # Signaling
    JOIN = "join"
    LEAVE = "leave"
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice-candidate"
    
    # Meeting updates
    USER_JOINED = "user-joined"
    USER_LEFT = "user-left"
    PARTICIPANTS_UPDATE = "participants-update"
    
    # Media controls
    AUDIO_TOGGLE = "audio-toggle"
    VIDEO_TOGGLE = "video-toggle"
    SCREEN_SHARE_START = "screen-share-start"
    SCREEN_SHARE_STOP = "screen-share-stop"
    
    # Chat
    CHAT_MESSAGE = "chat-message"
    CHAT_HISTORY = "chat-history"
    
    # System
    ERROR = "error"
    SUCCESS = "success"
