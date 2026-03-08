/** Read-only contract interface for ChainLog CLI. */

import { ethers } from "ethers";
import { CHAINLOG_ABI, BASE_SEPOLIA_RPC, BASE_MAINNET_RPC } from "./abi.js";

export interface ActionRecord {
  actionHash: string;
  metadataURI: string;
  timestamp: number;
  submitter: string;
}

export function getContract(
  contractAddress: string,
  rpcUrl?: string
): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(rpcUrl ?? BASE_SEPOLIA_RPC);
  return new ethers.Contract(contractAddress, CHAINLOG_ABI, provider);
}

export function getRpcUrl(network: string): string {
  if (network === "mainnet" || network === "base") return BASE_MAINNET_RPC;
  return BASE_SEPOLIA_RPC;
}

export async function verifyAction(
  contract: ethers.Contract,
  agentId: string,
  index: number,
  claimedHash: string
): Promise<boolean> {
  const hashBytes = ethers.zeroPadValue(claimedHash, 32);
  return contract.verifyAction(agentId, index, hashBytes);
}

export async function getRecordCount(
  contract: ethers.Contract,
  agentId: string
): Promise<number> {
  const count: bigint = await contract.getRecordCount(agentId);
  return Number(count);
}

export async function getRecord(
  contract: ethers.Contract,
  agentId: string,
  index: number
): Promise<ActionRecord> {
  const result = await contract.agentLogs(agentId, index);
  return {
    actionHash: result.actionHash,
    metadataURI: result.metadataURI,
    timestamp: Number(result.timestamp),
    submitter: result.submitter,
  };
}

export async function getTotalActions(
  contract: ethers.Contract
): Promise<number> {
  const total: bigint = await contract.totalActions();
  return Number(total);
}
