/**
 * Configuration for the ChainLog SDK client.
 */
export interface ChainLogConfig {
  /** API key for the ChainLog cloud service (future use) */
  apiKey?: string;
  /** JSON-RPC URL for the Base network */
  rpcUrl?: string;
  /** Private key for signing transactions */
  privateKey?: string;
  /** Deployed ChainLog contract address */
  contractAddress?: string;
  /** Path to SQLite fallback database (default: ./chainlog.db) */
  dbPath?: string;
  /** Fire-and-forget mode: don't await chain confirmation (default: true) */
  async?: boolean;
  /** Maximum batch size before auto-flush (default: 50) */
  batchSize?: number;
  /** Batch flush interval in milliseconds (default: 5000) */
  flushIntervalMs?: number;
}

/**
 * Input for a traced action.
 */
export interface TraceInput<T = unknown> {
  /** Unique identifier for the agent */
  agentId: string;
  /** Type of action being performed */
  actionType: string;
  /** Model identifier (e.g., "claude-sonnet-4-6") */
  modelId?: string;
  /** Input data to the agent (will be hashed, not stored on-chain) */
  input: unknown;
  /** Async function that performs the actual action */
  execute: () => Promise<T>;
  /** Optional metadata (will be included in the hash) */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a traced action.
 */
export interface TraceResult<T = unknown> {
  /** The agent's actual output */
  output: T;
  /** keccak256 hash of the full action record */
  actionHash: string;
  /** Blockchain transaction hash (null if async or fallback) */
  txHash: string | null;
  /** Duration of the agent execution in milliseconds */
  durationMs: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether the record was written to chain or stored locally */
  stored: "chain" | "local";
}

/**
 * Internal action record used for hashing.
 */
export interface ActionRecord {
  agentId: string;
  actionType: string;
  modelId: string;
  inputHash: string;
  outputHash: string;
  timestamp: string;
  durationMs: number;
  metadata: Record<string, unknown>;
}

/**
 * Row stored in the local SQLite fallback.
 */
export interface LocalRecord {
  id: number;
  agentId: string;
  actionHash: string;
  actionRecord: string;
  metadataUri: string;
  txHash: string | null;
  synced: boolean;
  createdAt: string;
}
