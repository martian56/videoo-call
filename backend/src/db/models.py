from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid
from src.db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


def generate_meeting_code():
    """Generate a random 10-character meeting code like Google Meet"""
    import random
    import string
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=10))


class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String(10), unique=True, nullable=False, default=generate_meeting_code, index=True)
    title = Column(String(255), nullable=True)
    created_by_ip = Column(String(45), nullable=True)  # IPv4 or IPv6
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    max_participants = Column(Integer, default=10)
    settings = Column(JSON, default=dict)  # Store meeting settings like waiting room, recording, etc.
    
    # Relationships
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    logs = relationship("MeetingLog", back_populates="meeting", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Meeting {self.code}>"


class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(String(100), nullable=False, index=True)  # WebSocket client ID
    display_name = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    left_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    is_host = Column(Boolean, default=False)
    
    # Media status
    audio_enabled = Column(Boolean, default=True)
    video_enabled = Column(Boolean, default=True)
    screen_sharing = Column(Boolean, default=False)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    
    def __repr__(self):
        return f"<Participant {self.display_name or self.client_id}>"


class MeetingLog(Base):
    __tablename__ = "meeting_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    participant_id = Column(String, ForeignKey("participants.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)  # join, leave, mute, unmute, start_video, stop_video, etc.
    event_data = Column(JSON, nullable=True)  # Additional event data
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    
    # Relationships
    meeting = relationship("Meeting", back_populates="logs")
    
    def __repr__(self):
        return f"<MeetingLog {self.event_type} at {self.timestamp}>"
