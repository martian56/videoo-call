import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_meeting(client: AsyncClient, sample_meeting_data):
    """Test creating a new meeting"""
    response = await client.post("/api/meetings", json=sample_meeting_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "code" in data
    assert len(data["code"]) == 10
    assert data["title"] == sample_meeting_data["title"]
    assert data["max_participants"] == sample_meeting_data["max_participants"]
    assert data["is_active"] is True
    assert data["participant_count"] == 0


@pytest.mark.asyncio
async def test_create_meeting_without_title(client: AsyncClient):
    """Test creating a meeting without optional title"""
    response = await client.post("/api/meetings", json={"max_participants": 5})
    
    assert response.status_code == 200
    data = response.json()
    
    assert "code" in data
    assert len(data["code"]) == 10
    assert data["title"] is None
    assert data["max_participants"] == 5


@pytest.mark.asyncio
async def test_create_meeting_default_max_participants(client: AsyncClient):
    """Test creating a meeting with default max_participants"""
    response = await client.post("/api/meetings", json={})
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["max_participants"] == 10  # Default value


@pytest.mark.asyncio
async def test_create_meeting_invalid_max_participants(client: AsyncClient):
    """Test creating a meeting with invalid max_participants"""
    # Too low
    response = await client.post("/api/meetings", json={"max_participants": 0})
    assert response.status_code == 422
    
    # Too high
    response = await client.post("/api/meetings", json={"max_participants": 100})
    assert response.status_code == 422
    
    # Negative
    response = await client.post("/api/meetings", json={"max_participants": -5})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_meeting(client: AsyncClient, sample_meeting_data):
    """Test retrieving a meeting by code"""
    # First create a meeting
    create_response = await client.post("/api/meetings", json=sample_meeting_data)
    meeting_code = create_response.json()["code"]
    
    # Then retrieve it
    response = await client.get(f"/api/meetings/{meeting_code}")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["code"] == meeting_code
    assert data["title"] == sample_meeting_data["title"]


@pytest.mark.asyncio
async def test_get_nonexistent_meeting(client: AsyncClient):
    """Test retrieving a non-existent meeting"""
    response = await client.get("/api/meetings/nonexistent")
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Meeting not found"


@pytest.mark.asyncio
async def test_get_participants_empty(client: AsyncClient, sample_meeting_data):
    """Test getting participants from a meeting with no participants"""
    # Create a meeting
    create_response = await client.post("/api/meetings", json=sample_meeting_data)
    meeting_code = create_response.json()["code"]
    
    # Get participants
    response = await client.get(f"/api/meetings/{meeting_code}/participants")
    
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_get_participants_nonexistent_meeting(client: AsyncClient):
    """Test getting participants from a non-existent meeting"""
    response = await client.get("/api/meetings/nonexistent/participants")
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_multiple_meetings_creation(client: AsyncClient):
    """Test creating multiple meetings and ensure unique codes"""
    codes = set()
    
    for i in range(5):
        response = await client.post("/api/meetings", json={"title": f"Meeting {i}"})
        assert response.status_code == 200
        
        code = response.json()["code"]
        assert code not in codes  # Ensure unique codes
        codes.add(code)
    
    assert len(codes) == 5


@pytest.mark.asyncio
async def test_meeting_code_format(client: AsyncClient):
    """Test that meeting codes follow the expected format"""
    response = await client.post("/api/meetings", json={})
    
    assert response.status_code == 200
    code = response.json()["code"]
    
    # Should be 10 characters
    assert len(code) == 10
    # Should be alphanumeric
    assert code.isalnum()


@pytest.mark.asyncio
async def test_meeting_timestamps(client: AsyncClient):
    """Test that meeting has proper timestamps"""
    response = await client.post("/api/meetings", json={"title": "Timestamp Test"})
    
    assert response.status_code == 200
    data = response.json()
    
    assert "created_at" in data
    assert data["created_at"] is not None
    
    # Should be ISO format timestamp
    from datetime import datetime
    datetime.fromisoformat(data["created_at"].replace('Z', '+00:00'))
