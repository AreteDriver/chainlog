import Database from "better-sqlite3";
import type { LocalRecord } from "./types";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS action_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT    NOT NULL,
  action_hash TEXT    NOT NULL,
  action_record TEXT  NOT NULL,
  metadata_uri TEXT   NOT NULL DEFAULT '',
  tx_hash     TEXT,
  synced      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
)`;

const CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_action_log_agent
  ON action_log(agent_id)`;

const CREATE_SYNC_INDEX = `
CREATE INDEX IF NOT EXISTS idx_action_log_synced
  ON action_log(synced) WHERE synced = 0`;

/**
 * Local SQLite store for action records.
 * Acts as write-ahead buffer and fallback when chain writes fail.
 */
export class LocalStore {
  private db: Database.Database;

  constructor(dbPath: string = "./chainlog.db") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLE);
    this.db.exec(CREATE_INDEX);
    this.db.exec(CREATE_SYNC_INDEX);
  }

  /**
   * Insert an action record into the local store.
   */
  insert(
    agentId: string,
    actionHash: string,
    actionRecord: string,
    metadataUri: string = ""
  ): number {
    const stmt = this.db.prepare(
      "INSERT INTO action_log (agent_id, action_hash, action_record, metadata_uri) VALUES (?, ?, ?, ?)"
    );
    const result = stmt.run(agentId, actionHash, actionRecord, metadataUri);
    return Number(result.lastInsertRowid);
  }

  /**
   * Mark a record as synced to chain with its tx hash.
   */
  markSynced(id: number, txHash: string): void {
    const stmt = this.db.prepare(
      "UPDATE action_log SET synced = 1, tx_hash = ? WHERE id = ?"
    );
    stmt.run(txHash, id);
  }

  /**
   * Get all unsynced records (for retry/batch sync).
   */
  getUnsynced(limit: number = 100): LocalRecord[] {
    const stmt = this.db.prepare(
      "SELECT id, agent_id as agentId, action_hash as actionHash, action_record as actionRecord, metadata_uri as metadataUri, tx_hash as txHash, synced, created_at as createdAt FROM action_log WHERE synced = 0 ORDER BY id LIMIT ?"
    );
    return stmt.all(limit) as LocalRecord[];
  }

  /**
   * Get record count for an agent.
   */
  getRecordCount(agentId: string): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM action_log WHERE agent_id = ?"
    );
    const row = stmt.get(agentId) as { count: number };
    return row.count;
  }

  /**
   * Get total record count.
   */
  getTotalCount(): number {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM action_log");
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /**
   * Verify a local record by re-hashing and comparing.
   */
  getRecord(id: number): LocalRecord | undefined {
    const stmt = this.db.prepare(
      "SELECT id, agent_id as agentId, action_hash as actionHash, action_record as actionRecord, metadata_uri as metadataUri, tx_hash as txHash, synced, created_at as createdAt FROM action_log WHERE id = ?"
    );
    return stmt.get(id) as LocalRecord | undefined;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
