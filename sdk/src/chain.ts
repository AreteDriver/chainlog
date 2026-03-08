import { Contract, JsonRpcProvider, Wallet } from "ethers";

/** Minimal ABI for ChainLog.sol — only the functions we call */
const CHAINLOG_ABI = [
  "function logAction(string agentId, bytes32 actionHash, string metadataURI) external",
  "function logBatch(string agentId, bytes32[] actionHashes, string[] metadataURIs) external",
  "function verifyAction(string agentId, uint256 index, bytes32 claimedHash) external view returns (bool)",
  "function getRecordCount(string agentId) external view returns (uint256)",
  "function totalActions() external view returns (uint256)",
  "event ActionLogged(string indexed agentId, bytes32 indexed actionHash, uint256 timestamp, address submitter)",
];

const BASE_SEPOLIA_RPC = "https://sepolia.base.org";

export interface ChainWriteResult {
  txHash: string;
}

/**
 * On-chain writer for ChainLog contract.
 */
export class ChainWriter {
  private contract: Contract;
  private wallet: Wallet;

  constructor(
    contractAddress: string,
    privateKey: string,
    rpcUrl: string = BASE_SEPOLIA_RPC
  ) {
    const provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, provider);
    this.contract = new Contract(contractAddress, CHAINLOG_ABI, this.wallet);
  }

  /**
   * Write a single action to the blockchain.
   * Returns the transaction hash.
   */
  async logAction(
    agentId: string,
    actionHash: string,
    metadataURI: string = ""
  ): Promise<ChainWriteResult> {
    const tx = await this.contract.logAction(agentId, actionHash, metadataURI);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  /**
   * Write a single action without waiting for confirmation (fire-and-forget).
   * Returns the transaction hash immediately.
   */
  async logActionAsync(
    agentId: string,
    actionHash: string,
    metadataURI: string = ""
  ): Promise<string> {
    const tx = await this.contract.logAction(agentId, actionHash, metadataURI);
    return tx.hash;
  }

  /**
   * Write a batch of actions in a single transaction.
   */
  async logBatch(
    agentId: string,
    actionHashes: string[],
    metadataURIs: string[]
  ): Promise<ChainWriteResult> {
    const tx = await this.contract.logBatch(
      agentId,
      actionHashes,
      metadataURIs
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  /**
   * Verify an action hash against the on-chain record.
   */
  async verifyAction(
    agentId: string,
    index: number,
    claimedHash: string
  ): Promise<boolean> {
    return this.contract.verifyAction(agentId, index, claimedHash);
  }

  /**
   * Get the number of records for an agent.
   */
  async getRecordCount(agentId: string): Promise<number> {
    const count = await this.contract.getRecordCount(agentId);
    return Number(count);
  }

  /**
   * Get the signer's address.
   */
  get address(): string {
    return this.wallet.address;
  }
}
