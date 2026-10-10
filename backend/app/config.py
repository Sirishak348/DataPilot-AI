import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

APP_BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = APP_BASE_DIR / ".env"
ROOT_ENV_PATH = APP_BASE_DIR.parent / ".env"

# Explicitly load .env into os.environ if it exists from backend/.env first, then root/.env
if ROOT_ENV_PATH.exists():
    load_dotenv(dotenv_path=ROOT_ENV_PATH, override=False)
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)

def read_env_file_direct(var_name: str) -> str:
    """Fallback reader directly inspecting .env file to prevent empty environment overrides."""
    for p in [ENV_PATH, ROOT_ENV_PATH]:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith(f"{var_name}="):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return ""

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "DataPilot AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    BASE_DIR: str = str(APP_BASE_DIR)

    # Database
    DATABASE_URL: str = f"sqlite:///{APP_BASE_DIR}/datapilot.db"

    # Security
    SECRET_KEY: str = "datapilot-ai-production-grade-super-secret-key-2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Storage
    STORAGE_DIR: str = str(APP_BASE_DIR / "storage")
    MAX_UPLOAD_SIZE_MB: int = 50

    # Google Gemini API
    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

settings = Settings()

# Ensure GEMINI_API_KEY is not overridden by empty env vars
if not settings.GEMINI_API_KEY.strip():
    direct_key = read_env_file_direct("GEMINI_API_KEY")
    if direct_key:
        settings.GEMINI_API_KEY = direct_key
        os.environ["GEMINI_API_KEY"] = direct_key

def get_effective_gemini_key() -> str:
    """Safely retrieves the configured Gemini API key without exposing it."""
    key = settings.GEMINI_API_KEY.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        key = read_env_file_direct("GEMINI_API_KEY")
    return key

# Ensure storage directories exist
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "datasets"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "cleaned"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "models"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "reports"), exist_ok=True)
os.makedirs(os.path.join(settings.STORAGE_DIR, "predictions"), exist_ok=True)
