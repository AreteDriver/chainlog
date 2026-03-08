"""Local SQLite store for action records."""

from __future__ import annotations

import sqlite3
from typing import Any


class LocalStore:
    """SQLite WAL store — write-ahead buffer and fallback for chain writes."""

    def __init__(self, db_path: str = "./chainlog.db") -> None:
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self) -> None:
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS action_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id     TEXT    NOT NULL,
                action_hash  TEXT    NOT NULL,
                action_record TEXT   NOT NULL,
                metadata_uri TEXT    NOT NULL DEFAULT '',
                tx_hash      TEXT,
                synced       INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_action_log_agent
                ON action_log(agent_id);
            CREATE INDEX IF NOT EXISTS idx_action_log_synced
                ON action_log(synced) WHERE synced = 0;
        """)

    def insert(
        self,
        agent_id: str,
        action_hash: str,
        action_record: str,
        metadata_uri: str = "",
    ) -> int:
        """Insert an action record. Returns the row id."""
        cursor = self.db.execute(
            "INSERT INTO action_log "
            "(agent_id, action_hash, action_record, metadata_uri) "
            "VALUES (?, ?, ?, ?)",
            (agent_id, action_hash, action_record, metadata_uri),
        )
        self.db.commit()
        return cursor.lastrowid or 0

    def mark_synced(self, row_id: int, tx_hash: str) -> None:
        """Mark a record as synced to chain."""
        self.db.execute(
            "UPDATE action_log SET synced = 1, tx_hash = ? WHERE id = ?",
            (tx_hash, row_id),
        )
        self.db.commit()

    def get_unsynced(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get unsynced records for retry."""
        cursor = self.db.execute(
            "SELECT * FROM action_log WHERE synced = 0 ORDER BY id LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cursor.fetchall()]

    def get_record_count(self, agent_id: str) -> int:
        """Get record count for an agent."""
        cursor = self.db.execute(
            "SELECT COUNT(*) FROM action_log WHERE agent_id = ?",
            (agent_id,),
        )
        return cursor.fetchone()[0]

    def get_total_count(self) -> int:
        """Get total record count."""
        cursor = self.db.execute("SELECT COUNT(*) FROM action_log")
        return cursor.fetchone()[0]

    def get_record(self, row_id: int) -> dict[str, Any] | None:
        """Get a record by id."""
        cursor = self.db.execute(
            "SELECT * FROM action_log WHERE id = ?",
            (row_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    def close(self) -> None:
        """Close the database connection."""
        self.db.close()
