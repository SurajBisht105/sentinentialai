# app/config.py
import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SentinelAI"
    APP_VERSION: str = "2.4.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # API
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://app.sentinelai.io",
    ]
    ALLOWED_HOSTS: List[str] = ["*"]

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWKS_URL: str = ""
    SUPABASE_DB_USER: str = "postgres"
    SUPABASE_DB_PASSWORD: str = "postgres"
    SUPABASE_DB_HOST: str = "localhost"
    SUPABASE_DB_PORT: int = 5432

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "127.0.0.1:9092"
    KAFKA_SECURITY_PROTOCOL: str = "PLAINTEXT"
    KAFKA_SASL_MECHANISM: Optional[str] = None
    KAFKA_SASL_USERNAME: Optional[str] = None
    KAFKA_SASL_PASSWORD: Optional[str] = None

    # Kafka Topics
    KAFKA_TOPIC_DIRECTOR: str = "agent.tasks.director"
    KAFKA_TOPIC_PLANNER: str = "agent.tasks.planner"
    KAFKA_TOPIC_SAST: str = "agent.sast"
    KAFKA_TOPIC_DAST: str = "agent.dast"
    KAFKA_TOPIC_SCA: str = "agent.sca"
    KAFKA_TOPIC_SECRETS: str = "agent.secrets"
    KAFKA_TOPIC_IAC: str = "agent.iac"
    KAFKA_TOPIC_CONSENSUS: str = "agent.consensus"
    KAFKA_TOPIC_PR_REVIEW: str = "agent.pr_review"
    KAFKA_TOPIC_COMPLIANCE: str = "agent.compliance"
    KAFKA_TOPIC_THREAT_INTEL: str = "agent.threat_intel"
    KAFKA_TOPIC_JAILBREAK: str = "agent.jailbreak"
    KAFKA_TOPIC_AUDIT: str = "agent.audit"

    # LLM
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL_MAIN: str = "ollama/llama3"
    LLM_MODEL_FAST: str = "ollama/llama3"
    LLM_MODEL_REASONING: str = "ollama/llama3"
    OPENAI_API_KEY: Optional[str] = "sk-ollama-local"
    ANTHROPIC_API_KEY: Optional[str] = None
    OLLAMA_API_BASE: str = "http://localhost:11434"
    OLLAMA_API_KEY: Optional[str] = "ollama-key"
    LLM_RATE_LIMIT: int = 100  # requests per minute
    LLM_MAX_TOKENS: int = 4096
    LLM_TEMPERATURE: float = 0.1
    LLM_TIMEOUT_SECONDS: int = 180

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PREFIX: str = "sentinel:"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "RS256"

    # Sandbox
    SANDBOX_ENABLED: bool = True
    SANDBOX_TIMEOUT_SECONDS: int = 300
    SANDBOX_MEMORY_LIMIT_MB: int = 512

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Audit
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 365

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()