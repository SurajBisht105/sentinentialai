# app/kafka/consumer.py
import asyncio
import aiokafka
import structlog
import json
from typing import Callable, Dict

from app.config import settings
from app.agents.director_agent import DirectorAgent
from app.agents.orchestration.planner_agent import PlannerAgent
from app.agents.sast_agent import SASTAgent
from app.agents.defensive.sca_agent import SCAAgent
from app.agents.defensive.secrets_agent import SecretsAgent
from app.agents.defensive.dast_agent import DASTAgent
from app.agents.defensive.iac_agent import IaCAgent
from app.agents.consensus_agent import ConsensusAgent
from app.agents.verification.pr_review_agent import PRReviewAgent

logger = structlog.get_logger(__name__)


class AgentConsumer:
    def __init__(self, topic: str, agent_handler: Callable):
        self.topic = topic
        self.agent_handler = agent_handler
        self.consumer: aiokafka.AIOKafkaConsumer = None

    async def start(self):
        self.consumer = aiokafka.AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=f"sentinel-{self.topic}-group",
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
        try:
            await self.consumer.start()
        except Exception as e:
            logger.warning("kafka_consumer_unavailable", topic=self.topic, error=str(e))
            await self.consumer.stop()  # Clean up to prevent "Unclosed" warnings
            self.consumer = None
            return
        logger.info("agent_consumer_started", topic=self.topic)

        try:
            async for msg in self.consumer:
                try:
                    await self.agent_handler(msg.value)
                    await self.consumer.commit()
                except Exception as e:
                    logger.error("agent_processing_failed", topic=self.topic, error=str(e))
        finally:
            await self.consumer.stop()

    async def stop(self):
        if self.consumer:
            await self.consumer.stop()


async def handle_director_task(event: Dict):
    agent = DirectorAgent()
    await agent.process(event)


async def handle_planner_task(event: Dict):
    agent = PlannerAgent()
    await agent.process(event)


async def handle_sast_task(event: Dict):
    agent = SASTAgent()
    # Pass the event as context - it already contains scan_id, repo_url, repo_path, branch
    await agent.process(event)


async def handle_sca_task(event: Dict):
    agent = SCAAgent()
    await agent.process(event)


async def handle_secrets_task(event: Dict):
    agent = SecretsAgent()
    await agent.process(event)


async def handle_dast_task(event: Dict):
    agent = DASTAgent()
    await agent.process(event)


async def handle_iac_task(event: Dict):
    agent = IaCAgent()
    await agent.process(event)


async def handle_consensus_task(event: Dict):
    agent = ConsensusAgent()
    await agent.process(event)


async def handle_pr_review_task(event: Dict):
    agent = PRReviewAgent()
    await agent.process(event)


async def start_kafka_consumers():
    """
    Start all agent consumers with retry logic
    """
    consumers = [
        AgentConsumer(settings.KAFKA_TOPIC_DIRECTOR, handle_director_task),
        AgentConsumer(settings.KAFKA_TOPIC_PLANNER, handle_planner_task),
        AgentConsumer(settings.KAFKA_TOPIC_SAST, handle_sast_task),
        AgentConsumer(settings.KAFKA_TOPIC_SCA, handle_sca_task),
        AgentConsumer(settings.KAFKA_TOPIC_SECRETS, handle_secrets_task),
        AgentConsumer(settings.KAFKA_TOPIC_DAST, handle_dast_task),
        AgentConsumer(settings.KAFKA_TOPIC_IAC, handle_iac_task),
        AgentConsumer(settings.KAFKA_TOPIC_CONSENSUS, handle_consensus_task),
        AgentConsumer(settings.KAFKA_TOPIC_PR_REVIEW, handle_pr_review_task),
    ]

    started_count = 0
    for i, consumer in enumerate(consumers):
        try:
            asyncio.create_task(consumer.start())
            started_count += 1
            logger.info(f"consumer_started", topic=consumer.topic)
        except Exception as e:
            logger.warning(
                f"consumer_start_failed",
                topic=consumer.topic,
                error=str(e),
            )

    logger.info("agent_consumers_started", count=started_count, total=len(consumers))

    if started_count == 0:
        logger.warning(
            "no_kafka_consumers_started",
            message="Kafka consumers not started — running without event processing",
        )