import os
import re
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables like CORS_ORIGINS
    )
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://localhost/videocall")
    
    @property
    def async_database_url(self) -> str:
        """Convert postgresql:// to postgresql+asyncpg://"""
        return re.sub(r'^postgresql:', 'postgresql+asyncpg:', self.database_url)
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    @property
    def cors_origins_str(self) -> str:
        """Get CORS origins as string from environment"""
        return os.getenv("CORS_ORIGINS", "http://localhost:5173,https://linkup.ufazien.com")
    
    @property
    def cors_origins(self) -> list[str]:
        """Get CORS origins as a list"""
        return [
            origin.strip()
            for origin in self.cors_origins_str.split(",")
            if origin.strip()
        ]
    
    # Application
    app_name: str = "LinkUp"
    debug: bool = os.getenv("DEBUG", "False").lower() == "true"


settings = Settings()
