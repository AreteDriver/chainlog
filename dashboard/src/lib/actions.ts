/** Read-only contract calls via ethers (no wallet needed). */

import { ethers } from "ethers";
import { CHAINLOG_ABI, BASE_SEPOLIA_RPC, CONTRACT_ADDRESS } from "./contract";

export interface ActionRecord {
  actionHash: string;
  metadataURI: string;
  timestamp: number;
  submitter: string;
}

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
}

function getContract(): ethers.Contract {
  return new ethers.Contract(CONTRACT_ADDRESS, CHAINLOG_ABI, getProvider());
}

export async function getRecordCount(agentId: string): Promise<number> {
  const contract = getContract();
  const count: bigint = await contract.getRecordCount(agentId);
  return Number(count);
}

export async function getRecord(
  agentId: string,
  index: number
): Promise<ActionRecord> {
  const contract = getContract();
  const result = await contract.agentLogs(agentId, index);
  return {
    actionHash: result.actionHash,
    metadataURI: result.metadataURI,
    timestamp: Number(result.timestamp),
    submitter: result.submitter,
  };
}

export async function getAgentTimeline(
  agentId: string,
  limit = 50
): Promise<ActionRecord[]> {
  const count = await getRecordCount(agentId);
  const start = Math.max(0, count - limit);
  const records: ActionRecord[] = [];

  for (let i = count - 1; i >= start; i--) {
    records.push(await getRecord(agentId, i));
  }

  return records;
}

export async function verifyAction(
  agentId: string,
  index: number,
  claimedHash: string
): Promise<boolean> {
  const contract = getContract();
  const hashBytes = ethers.zeroPadValue(claimedHash, 32);
  return contract.verifyAction(agentId, index, hashBytes);
}

export async function getTotalActions(): Promise<number> {
  const contract = getContract();
  const total: bigint = await contract.totalActions();
  return Number(total);
}

/** Detect anomalies: actions with unusual gaps or bursts. */
export function detectAnomalies(
  records: ActionRecord[]
): { index: number; type: string; detail: string }[] {
  if (records.length < 2) return [];

  const anomalies: { index: number; type: string; detail: string }[] = [];

  // Calculate intervals between consecutive actions
  const intervals: number[] = [];
  for (let i = 1; i < records.length; i++) {
    intervals.push(records[i - 1].timestamp - records[i].timestamp);
  }

  if (intervals.length === 0) return [];

  const avgInterval =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;

  for (let i = 0; i < intervals.length; i++) {
    // Burst: action happened within 1 second of previous
    if (intervals[i] <= 1 && avgInterval > 10) {
      anomalies.push({
        index: i + 1,
        type: "burst",
        detail: `Action occurred within 1s of previous (avg gap: ${Math.round(avgInterval)}s)`,
      });
    }

    // Gap: action gap is 10x the average
    if (intervals[i] > avgInterval * 10 && avgInterval > 0) {
      anomalies.push({
        index: i + 1,
        type: "gap",
        detail: `${Math.round(intervals[i] / 60)}min gap (avg: ${Math.round(avgInterval / 60)}min)`,
      });
    }
  }

  return anomalies;
}
