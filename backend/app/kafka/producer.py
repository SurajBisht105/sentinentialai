# app/kafka/producer.py
import asyncio
from typing import Any, Dict, Optional
import aiokafka
import structlog
import json

from app.config import settings

logger = structlog.get_logger(__name__)


class KafkaProducer:
    _instance: Optional[aiokafka.AIOKafkaProducer] = None

    async def get_producer(self) -> aiokafka.AIOKafkaProducer:
        if self._instance is None:
            producer = aiokafka.AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                security_protocol=settings.KAFKA_SECURITY_PROTOCOL,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                request_timeout_ms=3000,
            )
            try:
                await asyncio.wait_for(producer.start(), timeout=2.0)
            except Exception:
                try:
                    await producer.stop()
                except Exception:
                    pass
                raise
            self._instance = producer
            logger.info("kafka_producer_started")
        return self._instance

    async def send(
        self,
        topic: str,
        value: Dict[str, Any],
        key: Optional[bytes] = None,
    ):
        try:
            producer = await asyncio.wait_for(self.get_producer(), timeout=2.0)
            await asyncio.wait_for(
                producer.send_and_wait(topic, value=value, key=key),
                timeout=3.0,
            )
            logger.debug("kafka_message_sent", topic=topic, key=key.decode() if key else None)
        except Exception as e:
            self._instance = None
            logger.debug("kafka_send_failed", topic=topic, error=str(e))
            raise

    async def close(self):
        producer = self._instance
        self._instance = None
        if producer:
            await producer.stop()
            logger.info("kafka_producer_stopped")


# Singleton instance
kafka_producer = KafkaProducer()


async def init_kafka_producer():
    try:
        await kafka_producer.get_producer()
        logger.info("kafka_producer_initialized")
    except Exception as e:
        logger.warning(
            "kafka_producer_unavailable",
            error=str(e),
            message="Starting in direct scanner mode (Kafka unavailable)",
        )