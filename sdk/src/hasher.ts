import { keccak256, toUtf8Bytes, AbiCoder } from "ethers";
import type { ActionRecord } from "./types";

/**
 * Hash arbitrary data by JSON-serializing and applying keccak256.
 * Keys are sorted for deterministic output.
 */
export function hashData(data: unknown): string {
  const serialized = JSON.stringify(data, Object.keys(data as object).sort());
  return keccak256(toUtf8Bytes(serialized));
}

/**
 * Compute the canonical keccak256 hash of an ActionRecord.
 * Uses ABI encoding for Solidity-compatible hashing.
 */
export function hashActionRecord(record: ActionRecord): string {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["string", "string", "string", "bytes32", "bytes32", "string", "uint256"],
    [
      record.agentId,
      record.actionType,
      record.modelId,
      record.inputHash,
      record.outputHash,
      record.timestamp,
      record.durationMs,
    ]
  );
  return keccak256(encoded);
}

/**
 * Build an ActionRecord from trace inputs and outputs.
 */
export function buildActionRecord(
  agentId: string,
  actionType: string,
  modelId: string,
  input: unknown,
  output: unknown,
  timestamp: string,
  durationMs: number,
  metadata: Record<string, unknown>
): ActionRecord {
  return {
    agentId,
    actionType,
    modelId,
    inputHash: hashData(input),
    outputHash: hashData(output),
    timestamp,
    durationMs,
    metadata,
  };
}
