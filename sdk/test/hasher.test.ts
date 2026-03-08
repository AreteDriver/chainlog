import { describe, it, expect } from "vitest";
import { hashData, hashActionRecord, buildActionRecord } from "../src/hasher";

describe("hashData", () => {
  it("should return a keccak256 hex string", () => {
    const hash = hashData({ hello: "world" });
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    const a = hashData({ foo: "bar", baz: 42 });
    const b = hashData({ foo: "bar", baz: 42 });
    expect(a).toBe(b);
  });

  it("should produce the same hash regardless of key order", () => {
    const a = hashData({ z: 1, a: 2 });
    const b = hashData({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("should produce different hashes for different data", () => {
    const a = hashData({ action: "approve" });
    const b = hashData({ action: "deny" });
    expect(a).not.toBe(b);
  });
});

describe("hashActionRecord", () => {
  const record = buildActionRecord(
    "agent-1",
    "inference",
    "claude-sonnet-4-6",
    { prompt: "hello" },
    { response: "world" },
    "2026-03-08T14:00:00.000Z",
    150,
    {}
  );

  it("should return a keccak256 hex string", () => {
    const hash = hashActionRecord(record);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    const a = hashActionRecord(record);
    const b = hashActionRecord(record);
    expect(a).toBe(b);
  });

  it("should differ when any field changes", () => {
    const original = hashActionRecord(record);
    const modified = hashActionRecord({ ...record, agentId: "agent-2" });
    expect(original).not.toBe(modified);
  });
});

describe("buildActionRecord", () => {
  it("should hash input and output", () => {
    const record = buildActionRecord(
      "agent-1",
      "task",
      "model-1",
      { prompt: "test" },
      { result: "ok" },
      "2026-03-08T14:00:00.000Z",
      100,
      { env: "test" }
    );

    expect(record.agentId).toBe("agent-1");
    expect(record.actionType).toBe("task");
    expect(record.modelId).toBe("model-1");
    expect(record.inputHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(record.outputHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(record.durationMs).toBe(100);
    expect(record.metadata).toEqual({ env: "test" });
  });

  it("should produce different input/output hashes", () => {
    const record = buildActionRecord(
      "a",
      "b",
      "c",
      { x: 1 },
      { y: 2 },
      "2026-03-08T14:00:00.000Z",
      0,
      {}
    );
    expect(record.inputHash).not.toBe(record.outputHash);
  });
});
