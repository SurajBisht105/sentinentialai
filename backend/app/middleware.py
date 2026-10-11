# app/middleware.py
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

logger = structlog.get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Log request
        start_time = time.time()
        logger.info(
            "request_started",
            request_id=request_id,
            method=request.method,
            url=str(request.url),
            headers=dict(request.headers),
            client_ip=request.client.host if request.client else None,
        )

        # Process request
        try:
            response = await call_next(request)
            process_time = time.time() - start_time

            # Log response
            logger.info(
                "request_completed",
                request_id=request_id,
                method=request.method,
                url=str(request.url),
                status_code=response.status_code,
                process_time=process_time,
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response
        except Exception as exc:
            process_time = time.time() - start_time
            logger.error(
                "request_failed",
                request_id=request_id,
                method=request.method,
                url=str(request.url),
                error=str(exc),
                process_time=process_time,
                exc_info=True,
            )
            raise


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware."""

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests = {}  # In production, use Redis or similar

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Simple IP-based rate limiting (for demonstration)
        # In production, use Redis or a proper rate limiting library
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()

        # Clean old entries (older than 1 minute)
        self.requests = {
            ip: timestamps for ip, timestamps in self.requests.items()
            if any(t > current_time - 60 for t in timestamps)
        }

        # Add current request
        if client_ip not in self.requests:
            self.requests[client_ip] = []
        self.requests[client_ip].append(current_time)

        # Check rate limit
        recent_requests = [
            t for t in self.requests[client_ip]
            if t > current_time - 60
        ]

        if len(recent_requests) > self.requests_per_minute:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
            )

        response = await call_next(request)
        return response