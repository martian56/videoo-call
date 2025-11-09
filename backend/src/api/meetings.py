from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime, UTC

from src.db.database import get_db
from src.db.models import Meeting, Participant
from src.core.schemas import MeetingCreate, MeetingResponse, ParticipantResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.post("", response_model=MeetingResponse)
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


@router.get("/{meeting_code}", response_model=MeetingResponse)
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


@router.get("/{meeting_code}/participants", response_model=List[ParticipantResponse])
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
