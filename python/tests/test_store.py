"""Tests for chainlog.store module."""

import os

import pytest

from chainlog.store import LocalStore

TEST_DB = "./test-chainlog-py.db"


@pytest.fixture
def store():
    s = LocalStore(TEST_DB)
    yield s
    s.close()
    for suffix in ("", "-wal", "-shm"):
        try:
            os.unlink(TEST_DB + suffix)
        except FileNotFoundError:
            pass


class TestInsert:
    def test_returns_row_id(self, store: LocalStore) -> None:
        row_id = store.insert("agent-1", "0xabc", '{"test": true}')
        assert row_id == 1

    def test_auto_increments(self, store: LocalStore) -> None:
        id1 = store.insert("agent-1", "0xabc", "{}")
        id2 = store.insert("agent-1", "0xdef", "{}")
        assert id2 == id1 + 1


class TestMarkSynced:
    def test_marks_record(self, store: LocalStore) -> None:
        row_id = store.insert("agent-1", "0xabc", "{}")
        store.mark_synced(row_id, "0xtx123")
        record = store.get_record(row_id)
        assert record is not None
        assert record["tx_hash"] == "0xtx123"
        assert record["synced"] == 1


class TestGetUnsynced:
    def test_returns_only_unsynced(self, store: LocalStore) -> None:
        id1 = store.insert("agent-1", "0xabc", "{}")
        store.insert("agent-1", "0xdef", "{}")
        store.mark_synced(id1, "0xtx")
        unsynced = store.get_unsynced()
        assert len(unsynced) == 1
        assert unsynced[0]["action_hash"] == "0xdef"

    def test_respects_limit(self, store: LocalStore) -> None:
        for i in range(5):
            store.insert("agent-1", f"0x{i}", "{}")
        assert len(store.get_unsynced(2)) == 2

    def test_empty_when_all_synced(self, store: LocalStore) -> None:
        row_id = store.insert("agent-1", "0xabc", "{}")
        store.mark_synced(row_id, "0xtx")
        assert len(store.get_unsynced()) == 0


class TestGetRecordCount:
    def test_counts_per_agent(self, store: LocalStore) -> None:
        store.insert("agent-a", "0x1", "{}")
        store.insert("agent-a", "0x2", "{}")
        store.insert("agent-b", "0x3", "{}")
        assert store.get_record_count("agent-a") == 2
        assert store.get_record_count("agent-b") == 1
        assert store.get_record_count("agent-c") == 0


class TestGetTotalCount:
    def test_counts_all(self, store: LocalStore) -> None:
        store.insert("a", "0x1", "{}")
        store.insert("b", "0x2", "{}")
        assert store.get_total_count() == 2

    def test_zero_when_empty(self, store: LocalStore) -> None:
        assert store.get_total_count() == 0


class TestGetRecord:
    def test_returns_record(self, store: LocalStore) -> None:
        row_id = store.insert("agent-1", "0xhash", '{"key":"value"}')
        record = store.get_record(row_id)
        assert record is not None
        assert record["agent_id"] == "agent-1"
        assert record["action_hash"] == "0xhash"

    def test_returns_none_for_missing(self, store: LocalStore) -> None:
        assert store.get_record(999) is None
