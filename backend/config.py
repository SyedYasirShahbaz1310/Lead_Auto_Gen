
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    GOOGLE_SHEET_ID: str = Field(default="1WfbbOks3xmzXImmHAXmER4P_cpBVAsgZlk_qpItFaaM")
    GOOGLE_SERVICE_ACCOUNT_JSON: str = Field(default="./service_account.json")
    GEMINI_API_KEY: str = Field(default="")
    BREVO_API_KEY: str = Field(default="")
    BREVO_SENDER_NAME: str = Field(default="Erha Technologies")
    BREVO_SENDER_EMAIL: str = Field(default="info@erhatechnologies.com")
    APILAYER_API_KEY: str = Field(default="")
    HUNTER_API_KEY: str = Field(default="")
    TOMBA_API_KEY: str = Field(default="")
    DOMAINSDB_API_KEY: str = Field(default="")
    PORT: int = Field(default=8000)
    NEXT_PUBLIC_BACKEND_URL: str = Field(default="http://localhost:8000")
    DISPATCH_DELAY_MIN: int = Field(default=120)
    DISPATCH_DELAY_MAX: int = Field(default=180)
    DEMO_FAST_DISPATCH: bool = Field(default=False)

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env") if (BASE_DIR / ".env").exists() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Resolve absolute path for service account json
def get_service_account_path() -> str:
    candidate = Path(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    if candidate.is_absolute() and candidate.exists():
        return str(candidate)
    
    # Relative to backend dir
    rel_path = (BASE_DIR / settings.GOOGLE_SERVICE_ACCOUNT_JSON).resolve()
    if rel_path.exists():
        return str(rel_path)
    
    # Check parent dir
    parent_path = (BASE_DIR.parent / settings.GOOGLE_SERVICE_ACCOUNT_JSON).resolve()
    if parent_path.exists():
        return str(parent_path)
        
    return str(rel_path)
