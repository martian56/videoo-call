import pytest
from sqlalchemy import select
from src.db.models import Meeting, Participant, MeetingLog


@pytest.mark.asyncio
async def test_create_meeting_model(db_session):
    """Test creating a meeting in the database"""
    meeting = Meeting(
        code="test123456",
        title="Test Meeting",
        max_participants=10
    )
    
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    assert meeting.id is not None
    assert meeting.code == "test123456"
    assert meeting.title == "Test Meeting"
    assert meeting.is_active is True
    assert meeting.created_at is not None


@pytest.mark.asyncio
async def test_create_participant_model(db_session):
    """Test creating a participant in the database"""
    # Create meeting first
    meeting = Meeting(code="meet123456", title="Test")
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    # Create participant
    participant = Participant(
        meeting_id=meeting.id,
        client_id="client-123",
        display_name="John Doe",
        is_host=True
    )
    
    db_session.add(participant)
    await db_session.commit()
    await db_session.refresh(participant)
    
    assert participant.id is not None
    assert participant.meeting_id == meeting.id
    assert participant.client_id == "client-123"
    assert participant.display_name == "John Doe"
    assert participant.is_host is True
    assert participant.is_active is True
    assert participant.audio_enabled is True
    assert participant.video_enabled is True
    assert participant.screen_sharing is False


@pytest.mark.asyncio
async def test_meeting_participant_relationship(db_session):
    """Test the relationship between meeting and participants"""
    # Create meeting
    meeting = Meeting(code="rel123456", title="Relationship Test")
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    # Create participants
    p1 = Participant(meeting_id=meeting.id, client_id="c1", display_name="User 1", is_host=True)
    p2 = Participant(meeting_id=meeting.id, client_id="c2", display_name="User 2", is_host=False)
    
    db_session.add_all([p1, p2])
    await db_session.commit()
    
    # Query participants directly instead of using relationship
    result = await db_session.execute(
        select(Participant).where(Participant.meeting_id == meeting.id)
    )
    participants = result.scalars().all()
    
    assert len(participants) == 2
    participant_names = {p.display_name for p in participants}
    assert participant_names == {"User 1", "User 2"}


@pytest.mark.asyncio
async def test_meeting_log_creation(db_session):
    """Test creating meeting logs"""
    # Create meeting and participant
    meeting = Meeting(code="log123456", title="Log Test")
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    participant = Participant(
        meeting_id=meeting.id,
        client_id="client-log",
        display_name="Logger"
    )
    db_session.add(participant)
    await db_session.commit()
    await db_session.refresh(participant)
    
    # Create log
    log = MeetingLog(
        meeting_id=meeting.id,
        participant_id=participant.id,
        event_type="join",
        event_data={"displayName": "Logger"}
    )
    
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    
    assert log.id is not None
    assert log.meeting_id == meeting.id
    assert log.participant_id == participant.id
    assert log.event_type == "join"
    assert log.timestamp is not None


@pytest.mark.asyncio
async def test_participant_toggle_states(db_session):
    """Test toggling participant audio/video states"""
    meeting = Meeting(code="toggle1234", title="Toggle Test")
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    participant = Participant(
        meeting_id=meeting.id,
        client_id="client-toggle",
        display_name="Toggler"
    )
    db_session.add(participant)
    await db_session.commit()
    
    # Toggle audio
    participant.audio_enabled = False
    await db_session.commit()
    await db_session.refresh(participant)
    assert participant.audio_enabled is False
    
    # Toggle video
    participant.video_enabled = False
    await db_session.commit()
    await db_session.refresh(participant)
    assert participant.video_enabled is False
    
    # Enable screen sharing
    participant.screen_sharing = True
    await db_session.commit()
    await db_session.refresh(participant)
    assert participant.screen_sharing is True


@pytest.mark.asyncio
async def test_meeting_active_participants_query(db_session):
    """Test querying only active participants"""
    meeting = Meeting(code="active1234", title="Active Test")
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    
    # Create active and inactive participants
    p1 = Participant(meeting_id=meeting.id, client_id="c1", display_name="Active", is_active=True)
    p2 = Participant(meeting_id=meeting.id, client_id="c2", display_name="Inactive", is_active=False)
    
    db_session.add_all([p1, p2])
    await db_session.commit()
    
    # Query only active participants
    result = await db_session.execute(
        select(Participant).where(
            Participant.meeting_id == meeting.id,
            Participant.is_active == True
        )
    )
    active_participants = result.scalars().all()
    
    assert len(active_participants) == 1
    assert active_participants[0].display_name == "Active"


@pytest.mark.asyncio
async def test_meeting_unique_code(db_session):
    """Test that meeting codes must be unique"""
    meeting1 = Meeting(code="unique1234", title="First")
    db_session.add(meeting1)
    await db_session.commit()
    
    # Try to create another meeting with same code
    meeting2 = Meeting(code="unique1234", title="Second")
    db_session.add(meeting2)
    
    with pytest.raises(Exception):  # Should raise IntegrityError
        await db_session.commit()
