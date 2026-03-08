"""ChainLog SDK client — the main public API."""

from __future__ import annotations

import functools
import json
import logging
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, TypeVar

from chainlog.hasher import build_action_record, hash_action_record, hash_data
from chainlog.store import LocalStore
from chainlog.types import ChainLogConfig, TraceResult

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ChainLog:
    """Tamper-proof audit trails for AI agents.

    Two lines of code. Every AI action, permanently on-chain.

    Example::

        log = ChainLog(ChainLogConfig(
            contract_address="0x...",
            private_key=os.environ["DEPLOYER_PRIVATE_KEY"],
        ))

        @log.trace(agent_id="my-agent", action_type="inference")
        async def run_agent(prompt: str) -> str:
            return await your_agent.complete(prompt)
    """

    def __init__(self, config: ChainLogConfig | None = None) -> None:
        self._config = config or ChainLogConfig()
        self._store = LocalStore(self._config.db_path)
        self._chain = None

        if self._config.contract_address and self._config.private_key:
            try:
                from chainlog.chain import ChainWriter

                self._chain = ChainWriter(
                    contract_address=self._config.contract_address,
                    private_key=self._config.private_key,
                    rpc_url=self._config.rpc_url,
                )
            except Exception as exc:
                logger.warning("Chain writer init failed: %s", exc)

    async def trace_action(
        self,
        agent_id: str,
        action_type: str,
        input_data: Any,
        execute: Callable[[], Awaitable[T]],
        model_id: str = "unknown",
        metadata: dict[str, Any] | None = None,
    ) -> TraceResult:
        """Trace an agent action.

        Executes the action, hashes the record, and writes the
        fingerprint to chain (or local fallback).

        Args:
            agent_id: Unique identifier for the agent.
            action_type: Type of action being performed.
            input_data: Input to the agent (will be hashed).
            execute: Async callable that performs the action.
            model_id: Model identifier.
            metadata: Optional metadata dict.

        Returns:
            TraceResult with output, hash, tx_hash, duration, timestamp.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        start_ns = time.perf_counter_ns()

        output = await execute()

        duration_ms = (time.perf_counter_ns() - start_ns) // 1_000_000

        record = build_action_record(
            agent_id=agent_id,
            action_type=action_type,
            model_id=model_id,
            input_data=input_data,
            output_data=output,
            timestamp=timestamp,
            duration_ms=duration_ms,
            metadata=metadata,
        )

        action_hash = hash_action_record(record)

        local_id = self._store.insert(
            agent_id=agent_id,
            action_hash=action_hash,
            action_record=json.dumps(
                {
                    "agent_id": record.agent_id,
                    "action_type": record.action_type,
                    "model_id": record.model_id,
                    "input_hash": record.input_hash,
                    "output_hash": record.output_hash,
                    "timestamp": record.timestamp,
                    "duration_ms": record.duration_ms,
                    "metadata": record.metadata,
                }
            ),
        )

        tx_hash = None
        stored = "local"

        if self._chain:
            try:
                result = await self._chain.log_action(agent_id, action_hash)
                tx_hash = result
                stored = "chain"
                self._store.mark_synced(local_id, tx_hash)
            except Exception as exc:
                logger.warning("Chain write failed (stored locally): %s", exc)

        return TraceResult(
            output=output,
            action_hash=action_hash,
            tx_hash=tx_hash,
            duration_ms=duration_ms,
            timestamp=timestamp,
            stored=stored,
        )

    def trace(
        self,
        agent_id: str,
        action_type: str,
        model_id: str = "unknown",
    ) -> Callable:
        """Decorator for tracing async functions.

        Example::

            @log.trace(agent_id="my-agent", action_type="inference")
            async def run(prompt: str) -> str:
                return await agent.complete(prompt)
        """

        def decorator(
            fn: Callable[..., Awaitable[T]],
        ) -> Callable[..., Awaitable[TraceResult]]:
            @functools.wraps(fn)
            async def wrapper(*args: Any, **kwargs: Any) -> TraceResult:
                return await self.trace_action(
                    agent_id=agent_id,
                    action_type=action_type,
                    input_data={"args": args, "kwargs": kwargs},
                    execute=lambda: fn(*args, **kwargs),
                    model_id=model_id,
                )

            return wrapper

        return decorator

    async def verify(
        self,
        agent_id: str,
        index: int,
        claimed_hash: str,
    ) -> bool:
        """Verify an action hash against the on-chain record."""
        if not self._chain:
            raise RuntimeError("No chain connection configured for verify")
        return await self._chain.verify_action(agent_id, index, claimed_hash)

    async def sync_pending(self, limit: int = 100) -> int:
        """Sync unsynced local records to chain."""
        if not self._chain:
            return 0

        unsynced = self._store.get_unsynced(limit)
        synced = 0

        for record in unsynced:
            try:
                tx_hash = await self._chain.log_action(
                    record["agent_id"], record["action_hash"]
                )
                self._store.mark_synced(record["id"], tx_hash)
                synced += 1
            except Exception:
                break

        return synced

    def stats(self) -> dict[str, int]:
        """Get local store statistics."""
        return {
            "total": self._store.get_total_count(),
            "unsynced": len(self._store.get_unsynced(0)),
        }

    @staticmethod
    def hash(data: Any) -> str:
        """Hash arbitrary data (utility for external verification)."""
        return hash_data(data)

    def close(self) -> None:
        """Close the SDK (cleanup database connection)."""
        self._store.close()
