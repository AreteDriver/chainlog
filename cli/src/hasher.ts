/** Offline hashing utilities — hash local data to compare with on-chain. */

import { ethers } from "ethers";

/**
 * Hash arbitrary JSON data using keccak256.
 * Deterministic: sorts keys, uses compact separators.
 */
export function hashData(data: unknown): string {
  const serialized = JSON.stringify(data, Object.keys(data as object).sort());
  return ethers.keccak256(ethers.toUtf8Bytes(serialized));
}

/**
 * Hash a local log file entry and return the keccak256 hash.
 * Expects a JSON object with the standard ActionRecord fields.
 */
export function hashLogEntry(entry: {
  agent_id: string;
  action_type: string;
  model_id: string;
  input_hash: string;
  output_hash: string;
  timestamp: string;
  duration_ms: number;
}): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "string",
        "string",
        "string",
        "bytes32",
        "bytes32",
        "string",
        "uint256",
      ],
      [
        entry.agent_id,
        entry.action_type,
        entry.model_id,
        entry.input_hash,
        entry.output_hash,
        entry.timestamp,
        entry.duration_ms,
      ]
    )
  );
}
