"""Cryptographic hashing utilities for ChainLog."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from web3 import Web3

if TYPE_CHECKING:
    from chainlog.types import ActionRecord


def hash_data(data: Any) -> str:
    """Hash arbitrary data by JSON-serializing with sorted keys and applying keccak256.

    Args:
        data: Any JSON-serializable data.

    Returns:
        Hex string of the keccak256 hash (0x-prefixed).
    """
    serialized = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return "0x" + Web3.keccak(text=serialized).hex()


def hash_action_record(record: ActionRecord) -> str:
    """Compute the canonical keccak256 hash of an ActionRecord.

    Uses ABI encoding for Solidity-compatible hashing.

    Args:
        record: The action record to hash.

    Returns:
        Hex string of the keccak256 hash (0x-prefixed).
    """

    encoded = Web3.solidity_keccak(
        ["string", "string", "string", "bytes32", "bytes32", "string", "uint256"],
        [
            record.agent_id,
            record.action_type,
            record.model_id,
            bytes.fromhex(record.input_hash[2:]),
            bytes.fromhex(record.output_hash[2:]),
            record.timestamp,
            record.duration_ms,
        ],
    )
    return "0x" + encoded.hex()


def build_action_record(
    agent_id: str,
    action_type: str,
    model_id: str,
    input_data: Any,
    output_data: Any,
    timestamp: str,
    duration_ms: int,
    metadata: dict[str, Any] | None = None,
) -> ActionRecord:
    """Build an ActionRecord from trace inputs and outputs.

    Args:
        agent_id: Unique identifier for the agent.
        action_type: Type of action performed.
        model_id: Model identifier.
        input_data: Input data (will be hashed).
        output_data: Output data (will be hashed).
        timestamp: ISO 8601 timestamp.
        duration_ms: Duration of the action in milliseconds.
        metadata: Optional metadata dict.

    Returns:
        ActionRecord with hashed input/output.
    """
    from chainlog.types import ActionRecord

    return ActionRecord(
        agent_id=agent_id,
        action_type=action_type,
        model_id=model_id,
        input_hash=hash_data(input_data),
        output_hash=hash_data(output_data),
        timestamp=timestamp,
        duration_ms=duration_ms,
        metadata=metadata or {},
    )
