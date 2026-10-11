# app/llm/gateway.py
from typing import List, Dict, Any, Optional
import litellm
import structlog
from datetime import datetime
import asyncio

from app.config import settings
from app.services.audit_service import AuditService

logger = structlog.get_logger(__name__)


_ollama_lock = asyncio.Lock()


class LLMGateway:
    """
    Centralized LLM gateway with rate limiting, routing, and audit logging
    """

    def __init__(self):
        self.audit_service = AuditService()
        self.request_count = 0
        self.last_reset = datetime.utcnow()

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2048,
        timeout: Optional[int] = None,
    ) -> Any:
        """
        Send chat completion request through gateway
        """
        # Rate limiting check
        await self.check_rate_limit()

        request_timeout = timeout or settings.LLM_TIMEOUT_SECONDS

        # Select model
        selected_model = model or settings.LLM_MODEL_MAIN

        # Ensure ollama prefix if using Ollama provider
        if settings.LLM_PROVIDER.lower() == "ollama" and not selected_model.startswith("ollama/"):
            selected_model = f"ollama/{selected_model}"

        kwargs: Dict[str, Any] = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "timeout": request_timeout,
        }

        # Add Ollama specific config
        is_ollama = settings.LLM_PROVIDER.lower() == "ollama" or selected_model.startswith("ollama/")
        if is_ollama:
            if getattr(settings, "OLLAMA_API_BASE", None):
                kwargs["api_base"] = settings.OLLAMA_API_BASE
            if getattr(settings, "OLLAMA_API_KEY", None):
                kwargs["api_key"] = settings.OLLAMA_API_KEY
                kwargs["extra_headers"] = {
                    "Authorization": f"Bearer {settings.OLLAMA_API_KEY}"
                }

        try:
            # Serialize calls for Ollama provider to prevent concurrency rejection
            if is_ollama:
                async with _ollama_lock:
                    response = await asyncio.wait_for(
                        litellm.acompletion(**kwargs),
                        timeout=request_timeout,
                    )
            else:
                response = await asyncio.wait_for(
                    litellm.acompletion(**kwargs),
                    timeout=request_timeout,
                )

            # Log usage
            await self.log_llm_usage(
                model=selected_model,
                tokens_input=response.usage.prompt_tokens,
                tokens_output=response.usage.completion_tokens,
            )

            return response

        except asyncio.TimeoutError:
            logger.error("llm_request_timeout", model=selected_model)
            raise
        except Exception as e:
            logger.error("llm_request_failed", model=selected_model, error=str(e))
            raise

    async def check_rate_limit(self):
        """
        Check rate limit for LLM requests
        """
        now = datetime.utcnow()

        # Reset counter every minute
        if (now - self.last_reset).total_seconds() > 60:
            self.request_count = 0
            self.last_reset = now

        if self.request_count >= settings.LLM_RATE_LIMIT:
            logger.warning("llm_rate_limit_exceeded")
            raise Exception("LLM rate limit exceeded")

        self.request_count += 1

    async def log_llm_usage(
        self,
        model: str,
        tokens_input: int,
        tokens_output: int,
    ):
        """
        Log LLM usage for cost tracking
        """
        await self.audit_service.log_event(
            actor_type="SYSTEM",
            actor_id="LLM_GATEWAY",
            actor_email=None,
            action="LLM_REQUEST",
            resource_type="LLM_USAGE",
            resource_id=model,
            details={
                "model": model,
                "tokens_input": tokens_input,
                "tokens_output": tokens_output,
                "tokens_total": tokens_input + tokens_output,
            },
            ip_address="internal",
            risk_level="LOW",
        )