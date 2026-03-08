"""Tests for chainlog.hasher module."""

import re

from chainlog.hasher import build_action_record, hash_action_record, hash_data

HEX_PATTERN = re.compile(r"^0x[a-f0-9]{64}$")


class TestHashData:
    def test_returns_hex_string(self) -> None:
        result = hash_data({"hello": "world"})
        assert HEX_PATTERN.match(result)

    def test_deterministic(self) -> None:
        a = hash_data({"foo": "bar", "baz": 42})
        b = hash_data({"foo": "bar", "baz": 42})
        assert a == b

    def test_key_order_independent(self) -> None:
        a = hash_data({"z": 1, "a": 2})
        b = hash_data({"a": 2, "z": 1})
        assert a == b

    def test_different_data_different_hash(self) -> None:
        a = hash_data({"action": "approve"})
        b = hash_data({"action": "deny"})
        assert a != b

    def test_handles_nested_data(self) -> None:
        result = hash_data({"outer": {"inner": [1, 2, 3]}})
        assert HEX_PATTERN.match(result)


class TestHashActionRecord:
    def test_returns_hex_string(self) -> None:
        record = build_action_record(
            "agent-1",
            "inference",
            "claude-sonnet-4-6",
            {"prompt": "hello"},
            {"response": "world"},
            "2026-03-08T14:00:00Z",
            150,
        )
        result = hash_action_record(record)
        assert HEX_PATTERN.match(result)

    def test_deterministic(self) -> None:
        record = build_action_record(
            "agent-1",
            "task",
            "model-1",
            {"x": 1},
            {"y": 2},
            "2026-03-08T14:00:00Z",
            100,
        )
        a = hash_action_record(record)
        b = hash_action_record(record)
        assert a == b

    def test_differs_on_field_change(self) -> None:
        base = build_action_record(
            "agent-1",
            "task",
            "model-1",
            {"x": 1},
            {"y": 2},
            "2026-03-08T14:00:00Z",
            100,
        )
        modified = build_action_record(
            "agent-2",
            "task",
            "model-1",
            {"x": 1},
            {"y": 2},
            "2026-03-08T14:00:00Z",
            100,
        )
        assert hash_action_record(base) != hash_action_record(modified)


class TestBuildActionRecord:
    def test_hashes_input_and_output(self) -> None:
        record = build_action_record(
            "agent-1",
            "task",
            "model-1",
            {"prompt": "test"},
            {"result": "ok"},
            "2026-03-08T14:00:00Z",
            100,
            {"env": "test"},
        )
        assert record.agent_id == "agent-1"
        assert record.action_type == "task"
        assert HEX_PATTERN.match(record.input_hash)
        assert HEX_PATTERN.match(record.output_hash)
        assert record.input_hash != record.output_hash
        assert record.metadata == {"env": "test"}
