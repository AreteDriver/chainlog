"""Type definitions for ChainLog SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChainLogConfig:
    """Configuration for the ChainLog SDK client."""

    api_key: str | None = None
    rpc_url: str | None = None
    private_key: str | None = None
    contract_address: str | None = None
    db_path: str = "./chainlog.db"
    async_writes: bool = True


@dataclass
class ActionRecord:
    """Internal action record used for hashing."""

    agent_id: str
    action_type: str
    model_id: str
    input_hash: str
    output_hash: str
    timestamp: str
    duration_ms: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TraceResult:
    """Result from a traced action."""

    output: Any
    action_hash: str
    tx_hash: str | None
    duration_ms: int
    timestamp: str
    stored: str  # "chain" or "local"
