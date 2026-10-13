from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./wetinnext.db"
    demo_mode: bool = True
    admin_key: str = ""
    demo_seed_password: str = "WetinNextDemo!2026"
    demo_admin_email: str = "admin@wetinnext.local"
    elasticsearch_url: str = ""
    elasticsearch_api_key: str = ""
    elasticsearch_index: str = Field(
        default="wetinnext-catalogue", pattern=r"^[a-z][a-z0-9_-]{0,79}$"
    )
    reliefweb_appname: str = ""
    auto_ingest: bool = True
    auto_publish: bool = True
    telegram_bot_token: str = ""
    telegram_service_secret: str = ""
    telegram_state_database: str = "telegram.db"
    gateway_service_url: str = "http://127.0.0.1:8000"
    source_refresh_hours: int = 6
    catalog_database: str = "catalog.db"
    supabase_url: str = ""
    research_database: str = "research.db"
    openai_api_key: str = ""
    openai_model: str = ""
    learner_service_url: str = "http://127.0.0.1:8001"
    catalog_service_url: str = "http://127.0.0.1:8002"
    matching_service_url: str = "http://127.0.0.1:8003"
    telegram_bot_url: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
