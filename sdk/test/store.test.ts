import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStore } from "../src/store";
import { unlinkSync } from "fs";

const TEST_DB = "./test-chainlog.db";

describe("LocalStore", () => {
  let store: LocalStore;

  beforeEach(() => {
    store = new LocalStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    try {
      unlinkSync(TEST_DB);
      unlinkSync(TEST_DB + "-wal");
      unlinkSync(TEST_DB + "-shm");
    } catch {
      // ignore cleanup errors
    }
  });

  describe("insert", () => {
    it("should insert a record and return its id", () => {
      const id = store.insert("agent-1", "0xabc", '{"test":true}');
      expect(id).toBe(1);
    });

    it("should auto-increment ids", () => {
      const id1 = store.insert("agent-1", "0xabc", "{}");
      const id2 = store.insert("agent-1", "0xdef", "{}");
      expect(id2).toBe(id1 + 1);
    });
  });

  describe("markSynced", () => {
    it("should mark a record as synced with tx hash", () => {
      const id = store.insert("agent-1", "0xabc", "{}");
      store.markSynced(id, "0xtx123");

      const record = store.getRecord(id);
      expect(record).toBeDefined();
      expect(record!.txHash).toBe("0xtx123");
      expect(record!.synced).toBe(1);
    });
  });

  describe("getUnsynced", () => {
    it("should return only unsynced records", () => {
      const id1 = store.insert("agent-1", "0xabc", "{}");
      store.insert("agent-1", "0xdef", "{}");
      store.markSynced(id1, "0xtx");

      const unsynced = store.getUnsynced();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].actionHash).toBe("0xdef");
    });

    it("should respect limit", () => {
      for (let i = 0; i < 5; i++) {
        store.insert("agent-1", `0x${i}`, "{}");
      }
      const unsynced = store.getUnsynced(2);
      expect(unsynced).toHaveLength(2);
    });

    it("should return empty array when all synced", () => {
      const id = store.insert("agent-1", "0xabc", "{}");
      store.markSynced(id, "0xtx");

      expect(store.getUnsynced()).toHaveLength(0);
    });
  });

  describe("getRecordCount", () => {
    it("should count records per agent", () => {
      store.insert("agent-a", "0x1", "{}");
      store.insert("agent-a", "0x2", "{}");
      store.insert("agent-b", "0x3", "{}");

      expect(store.getRecordCount("agent-a")).toBe(2);
      expect(store.getRecordCount("agent-b")).toBe(1);
      expect(store.getRecordCount("agent-c")).toBe(0);
    });
  });

  describe("getTotalCount", () => {
    it("should count all records", () => {
      store.insert("agent-a", "0x1", "{}");
      store.insert("agent-b", "0x2", "{}");

      expect(store.getTotalCount()).toBe(2);
    });

    it("should return 0 for empty store", () => {
      expect(store.getTotalCount()).toBe(0);
    });
  });

  describe("getRecord", () => {
    it("should return a record by id", () => {
      const id = store.insert("agent-1", "0xhash", '{"key":"value"}');
      const record = store.getRecord(id);

      expect(record).toBeDefined();
      expect(record!.agentId).toBe("agent-1");
      expect(record!.actionHash).toBe("0xhash");
      expect(record!.actionRecord).toBe('{"key":"value"}');
      expect(record!.synced).toBe(0);
    });

    it("should return undefined for missing id", () => {
      expect(store.getRecord(999)).toBeUndefined();
    });
  });
});
