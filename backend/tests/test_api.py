import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test the health check endpoint"""
    response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "healthy"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test the root endpoint"""
    response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["app"] == "LinkUp"
    assert data["version"] == "2.0"
    assert data["status"] == "running"
    assert "active_meetings" in data
    assert "total_participants" in data
