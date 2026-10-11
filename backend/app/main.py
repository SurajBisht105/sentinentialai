# app/main.py
import asyncio
import structlog
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.errors import ServerErrorMiddleware

from app.config import settings
from app.middleware import LoggingMiddleware, RateLimitMiddleware
from app.api.v1.router import api_router
from app.database.session import init_db
from app.kafka.producer import init_kafka_producer, kafka_producer
from app.kafka.consumer import start_kafka_consumers
from app.utils.logging import setup_logging
from app.api.v1.websockets import router as websocket_router


if sys.platform == "win32" and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("sentinel_startup", version=settings.APP_VERSION)
    await init_db()
    await init_kafka_producer()
    await start_kafka_consumers()
    logger.info("sentinel_ready", message="SentinelAI backend is ready")

    yield

    # Shutdown
    await kafka_producer.close()
    logger.info("sentinel_shutdown", message="Shutting down SentinelAI backend")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Agentic AI Security Operating System",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(ServerErrorMiddleware)

# Include routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/healthz")
async def health_check():
    """Simple health check endpoint that doesn't depend on external services"""
    return {"status": "ok"}