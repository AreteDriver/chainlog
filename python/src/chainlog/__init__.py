"""ChainLog — Tamper-proof audit trails for AI agents."""

from chainlog.client import ChainLog
from chainlog.hasher import build_action_record, hash_action_record, hash_data
from chainlog.store import LocalStore
from chainlog.types import (
    ActionRecord,
    ChainLogConfig,
    TraceResult,
)

__version__ = "0.1.0"
__all__ = [
    "ChainLog",
    "ChainLogConfig",
    "TraceResult",
    "ActionRecord",
    "LocalStore",
    "hash_data",
    "hash_action_record",
    "build_action_record",
]
