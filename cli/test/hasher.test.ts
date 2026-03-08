import { describe, it, expect } from "vitest";
import { hashData, hashLogEntry } from "../src/hasher.js";

describe("hashData", () => {
  it("returns 0x-prefixed 64-char hex string", () => {
    const result = hashData({ hello: "world" });
    expect(result).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashData({ foo: "bar", baz: 42 });
    const b = hashData({ foo: "bar", baz: 42 });
    expect(a).toBe(b);
  });

  it("differs for different data", () => {
    const a = hashData({ action: "approve" });
    const b = hashData({ action: "deny" });
    expect(a).not.toBe(b);
  });
});

describe("hashLogEntry", () => {
  const entry = {
    agent_id: "agent-1",
    action_type: "inference",
    model_id: "claude-sonnet-4-6",
    input_hash:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    output_hash:
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    timestamp: "2026-03-08T14:00:00Z",
    duration_ms: 150,
  };

  it("returns 0x-prefixed 64-char hex string", () => {
    const result = hashLogEntry(entry);
    expect(result).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashLogEntry(entry);
    const b = hashLogEntry(entry);
    expect(a).toBe(b);
  });

  it("differs when agent_id changes", () => {
    const a = hashLogEntry(entry);
    const b = hashLogEntry({ ...entry, agent_id: "agent-2" });
    expect(a).not.toBe(b);
  });

  it("differs when duration changes", () => {
    const a = hashLogEntry(entry);
    const b = hashLogEntry({ ...entry, duration_ms: 200 });
    expect(a).not.toBe(b);
  });
});
