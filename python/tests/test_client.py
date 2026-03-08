"""Tests for chainlog.client module."""

import asyncio
import os
import re

import pytest

from chainlog.client import ChainLog
from chainlog.types import ChainLogConfig

TEST_DB = "./test-chainlog-client.db"
HEX_PATTERN = re.compile(r"^0x[a-f0-9]{64}$")


@pytest.fixture
def log():
    client = ChainLog(ChainLogConfig(db_path=TEST_DB))
    yield client
    client.close()
    for suffix in ("", "-wal", "-shm"):
        try:
            os.unlink(TEST_DB + suffix)
        except FileNotFoundError:
            pass


class TestTraceAction:
    async def test_executes_and_returns_output(self, log: ChainLog) -> None:
        result = await log.trace_action(
            agent_id="test-agent",
            action_type="inference",
            input_data={"prompt": "hello"},
            execute=lambda: (
                asyncio.coroutine(lambda: {"response": "world"})()
                if False
                else asyncio.sleep(0, result={"response": "world"})
            ),
        )
        assert result.output == {"response": "world"}

    async def test_returns_valid_hash(self, log: ChainLog) -> None:
        result = await log.trace_action(
            agent_id="test-agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0, result="done"),
        )
        assert HEX_PATTERN.match(result.action_hash)

    async def test_stores_locally_without_chain(self, log: ChainLog) -> None:
        result = await log.trace_action(
            agent_id="test-agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0, result="done"),
        )
        assert result.stored == "local"
        assert result.tx_hash is None

    async def test_records_duration(self, log: ChainLog) -> None:
        result = await log.trace_action(
            agent_id="test-agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0.05, result="done"),
        )
        assert result.duration_ms >= 40
        assert result.duration_ms < 500

    async def test_includes_timestamp(self, log: ChainLog) -> None:
        result = await log.trace_action(
            agent_id="test-agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0, result="done"),
        )
        assert "T" in result.timestamp
        assert result.timestamp.endswith("+00:00")

    async def test_different_timestamps_different_hashes(self, log: ChainLog) -> None:
        r1 = await log.trace_action(
            agent_id="agent",
            action_type="task",
            input_data={"x": 1},
            execute=lambda: asyncio.sleep(0, result="out"),
        )
        await asyncio.sleep(0.01)
        r2 = await log.trace_action(
            agent_id="agent",
            action_type="task",
            input_data={"x": 1},
            execute=lambda: asyncio.sleep(0, result="out"),
        )
        assert r1.action_hash != r2.action_hash


class TestDecorator:
    async def test_trace_decorator(self, log: ChainLog) -> None:
        @log.trace(agent_id="agent-1", action_type="process")
        async def my_fn(text: str) -> str:
            return f"processed: {text}"

        result = await my_fn("hello")
        assert result.output == "processed: hello"
        assert HEX_PATTERN.match(result.action_hash)
        assert result.stored == "local"


class TestVerify:
    async def test_raises_without_chain(self, log: ChainLog) -> None:
        with pytest.raises(RuntimeError, match="No chain connection"):
            await log.verify("agent", 0, "0xabc")


class TestStats:
    async def test_reports_counts(self, log: ChainLog) -> None:
        await log.trace_action(
            agent_id="agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0, result="done"),
        )
        stats = log.stats()
        assert stats["total"] == 1


class TestSyncPending:
    async def test_returns_zero_without_chain(self, log: ChainLog) -> None:
        await log.trace_action(
            agent_id="agent",
            action_type="task",
            input_data={},
            execute=lambda: asyncio.sleep(0, result="done"),
        )
        assert await log.sync_pending() == 0


class TestStaticHash:
    def test_hashes_data(self) -> None:
        result = ChainLog.hash({"test": True})
        assert HEX_PATTERN.match(result)
