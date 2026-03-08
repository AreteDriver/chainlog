import { describe, it, expect, afterEach } from "vitest";
import { ChainLog } from "../src/chainlog";
import { unlinkSync } from "fs";

const TEST_DB = "./test-chainlog-sdk.db";

describe("ChainLog", () => {
  let log: ChainLog;

  afterEach(() => {
    if (log) log.close();
    try {
      unlinkSync(TEST_DB);
      unlinkSync(TEST_DB + "-wal");
      unlinkSync(TEST_DB + "-shm");
    } catch {
      // ignore cleanup errors
    }
  });

  describe("trace (local-only mode)", () => {
    it("should execute the action and return output", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const result = await log.trace({
        agentId: "test-agent",
        actionType: "inference",
        input: { prompt: "hello" },
        execute: async () => ({ response: "world" }),
      });

      expect(result.output).toEqual({ response: "world" });
    });

    it("should return a valid action hash", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const result = await log.trace({
        agentId: "test-agent",
        actionType: "inference",
        input: { prompt: "hello" },
        execute: async () => "output",
      });

      expect(result.actionHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should store as local when no chain configured", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const result = await log.trace({
        agentId: "test-agent",
        actionType: "task",
        input: {},
        execute: async () => "done",
      });

      expect(result.stored).toBe("local");
      expect(result.txHash).toBeNull();
    });

    it("should record duration in milliseconds", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const result = await log.trace({
        agentId: "test-agent",
        actionType: "task",
        input: {},
        execute: async () => {
          await new Promise((r) => setTimeout(r, 50));
          return "done";
        },
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(40);
      expect(result.durationMs).toBeLessThan(500);
    });

    it("should include ISO timestamp", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const before = new Date().toISOString();
      const result = await log.trace({
        agentId: "test-agent",
        actionType: "task",
        input: {},
        execute: async () => "done",
      });

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime() - 1000
      );
    });

    it("should produce different hashes for different executions", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      // Same input/output but with a delay so timestamps differ
      const r1 = await log.trace({
        agentId: "agent",
        actionType: "task",
        input: { x: 1 },
        execute: async () => "out",
      });

      await new Promise((r) => setTimeout(r, 10));

      const r2 = await log.trace({
        agentId: "agent",
        actionType: "task",
        input: { x: 1 },
        execute: async () => "out",
      });

      // Hashes differ because timestamps differ
      expect(r1.actionHash).not.toBe(r2.actionHash);
    });
  });

  describe("wrap", () => {
    it("should create a traced wrapper function", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      const myFn = async (input: string) => `processed: ${input}`;
      const traced = log.wrap("agent-1", "process", myFn);

      const result = await traced("hello");
      expect(result.output).toBe("processed: hello");
      expect(result.actionHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.stored).toBe("local");
    });
  });

  describe("verify", () => {
    it("should throw when no chain configured", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      await expect(
        log.verify("agent", 0, "0xabc")
      ).rejects.toThrow("no chain connection configured");
    });
  });

  describe("stats", () => {
    it("should report total and unsynced counts", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      await log.trace({
        agentId: "agent",
        actionType: "task",
        input: {},
        execute: async () => "done",
      });

      const stats = log.stats();
      expect(stats.total).toBe(1);
    });
  });

  describe("static hash", () => {
    it("should hash arbitrary data", () => {
      const hash = ChainLog.hash({ test: true });
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe("syncPending", () => {
    it("should return 0 when no chain configured", async () => {
      log = new ChainLog({ dbPath: TEST_DB });

      await log.trace({
        agentId: "agent",
        actionType: "task",
        input: {},
        execute: async () => "done",
      });

      const synced = await log.syncPending();
      expect(synced).toBe(0);
    });
  });
});
