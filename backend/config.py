import os
import re
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://localhost/videocall")
    
    @property
    def async_database_url(self) -> str:
        """Convert postgresql:// to postgresql+asyncpg://"""
        return re.sub(r'^postgresql:', 'postgresql+asyncpg:', self.database_url)
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # CORS
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    
    # Application
    app_name: str = "VideoCall"
    debug: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

