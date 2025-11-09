from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, UTC

from src.core.config import settings
from src.db.database import engine, Base
from src.api.meetings import router as meetings_router
from src.api.websocket import handle_websocket, active_connections, chat_messages
from fastapi import WebSocket

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

# Include routers
app.include_router(meetings_router)


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
@app.head("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(UTC).isoformat()}


@app.websocket("/ws/{meeting_code}/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    meeting_code: str,
    client_id: str,
):
    """WebSocket endpoint for real-time communication"""
    await handle_websocket(websocket, meeting_code, client_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)
