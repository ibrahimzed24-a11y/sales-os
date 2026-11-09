"""Runtime configuration for the Sales OS 5-agent pipeline."""
from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "sqlite:///./sales_os.db"
    # Email
    resend_api_key: str = ""
    sender_email: str = "sales@health.valioz.com"
    sender_name: str = "Valioz Health"
    # Canadian CASL footer
    legal_business_name: str = "Valioz Health Inc."
    mailing_address: str = "123 Queen St W, Toronto, ON M5H 2M9, Canada"
    unsubscribe_base_url: str = "https://osv.nilesupplies.com/unsubscribe"
    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    # Payments
    stripe_secret_key: str = ""
    stripe_success_url: str = "https://health.valioz.com/thank-you/"
    stripe_cancel_url: str = "https://health.valioz.com/"
    # Browser
    use_browser_use: bool = False
    # Throttling
    max_emails_per_domain_per_day: int = 25
    send_jitter_min: int = 180
    send_jitter_max: int = 420
    # Paths
    root_dir: Path = Path(__file__).resolve().parent
    template_path: Path = root_dir / "templates" / "email_pitch.html"


settings = Settings()


def get_settings() -> Settings:
    return settings
