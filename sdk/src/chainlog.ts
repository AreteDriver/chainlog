import type {
  ChainLogConfig,
  TraceInput,
  TraceResult,
} from "./types";
import { buildActionRecord, hashActionRecord, hashData } from "./hasher";
import { LocalStore } from "./store";
import { ChainWriter } from "./chain";

const DEFAULT_DB_PATH = "./chainlog.db";

/**
 * ChainLog SDK — tamper-proof audit trails for AI agents.
 *
 * @example
 * ```typescript
 * const log = new ChainLog({
 *   contractAddress: "0x...",
 *   privateKey: process.env.DEPLOYER_PRIVATE_KEY,
 * });
 *
 * const result = await log.trace({
 *   agentId: "my-agent",
 *   actionType: "inference",
 *   input: { prompt: "hello" },
 *   execute: async () => await myAgent.run("hello"),
 * });
 *
 * console.log(result.actionHash); // keccak256 fingerprint
 * console.log(result.txHash);     // blockchain receipt
 * ```
 */
export class ChainLog {
  private store: LocalStore;
  private chain: ChainWriter | null = null;
  private config: Required<
    Pick<ChainLogConfig, "async" | "batchSize" | "flushIntervalMs">
  > &
    ChainLogConfig;

  constructor(config: ChainLogConfig = {}) {
    this.config = {
      async: true,
      batchSize: 50,
      flushIntervalMs: 5000,
      ...config,
    };

    this.store = new LocalStore(config.dbPath ?? DEFAULT_DB_PATH);

    if (config.contractAddress && config.privateKey) {
      this.chain = new ChainWriter(
        config.contractAddress,
        config.privateKey,
        config.rpcUrl
      );
    }
  }

  /**
   * Trace an agent action. Executes the action, hashes the record,
   * and writes the fingerprint to chain (or local fallback).
   */
  async trace<T>(input: TraceInput<T>): Promise<TraceResult<T>> {
    const timestamp = new Date().toISOString();
    const startMs = performance.now();

    // Execute the actual agent action
    const output = await input.execute();

    const durationMs = Math.round(performance.now() - startMs);

    // Build the canonical action record
    const record = buildActionRecord(
      input.agentId,
      input.actionType,
      input.modelId ?? "unknown",
      input.input,
      output,
      timestamp,
      durationMs,
      input.metadata ?? {}
    );

    // Hash the record
    const actionHash = hashActionRecord(record);

    // Store locally first (write-ahead)
    const localId = this.store.insert(
      input.agentId,
      actionHash,
      JSON.stringify(record)
    );

    // Attempt chain write
    let txHash: string | null = null;
    let stored: "chain" | "local" = "local";

    if (this.chain) {
      try {
        if (this.config.async) {
          // Fire-and-forget: get tx hash immediately, don't block
          txHash = await this.chain.logActionAsync(
            input.agentId,
            actionHash
          );
          stored = "chain";
          // Mark synced in background (don't await)
          this.store.markSynced(localId, txHash);
        } else {
          // Wait for confirmation
          const result = await this.chain.logAction(
            input.agentId,
            actionHash
          );
          txHash = result.txHash;
          stored = "chain";
          this.store.markSynced(localId, txHash);
        }
      } catch {
        // Chain write failed — record stays in local store for retry
        stored = "local";
      }
    }

    return {
      output,
      actionHash,
      txHash,
      durationMs,
      timestamp,
      stored,
    };
  }

  /**
   * Decorator-style trace for wrapping existing async functions.
   *
   * @example
   * ```typescript
   * const tracedFn = log.wrap("my-agent", "inference", myAsyncFn);
   * const result = await tracedFn(input);
   * ```
   */
  wrap<TIn, TOut>(
    agentId: string,
    actionType: string,
    fn: (input: TIn) => Promise<TOut>,
    modelId?: string
  ): (input: TIn) => Promise<TraceResult<TOut>> {
    return async (input: TIn) => {
      return this.trace({
        agentId,
        actionType,
        modelId,
        input,
        execute: () => fn(input),
      });
    };
  }

  /**
   * Verify a local record against the on-chain hash.
   */
  async verify(
    agentId: string,
    index: number,
    claimedHash: string
  ): Promise<boolean> {
    if (!this.chain) {
      throw new Error("ChainLog: no chain connection configured for verify");
    }
    return this.chain.verifyAction(agentId, index, claimedHash);
  }

  /**
   * Sync unsynced local records to chain.
   * Useful for retry after chain write failures.
   */
  async syncPending(limit: number = 100): Promise<number> {
    if (!this.chain) {
      return 0;
    }

    const unsynced = this.store.getUnsynced(limit);
    let synced = 0;

    for (const record of unsynced) {
      try {
        const result = await this.chain.logAction(
          record.agentId,
          record.actionHash
        );
        this.store.markSynced(record.id, result.txHash);
        synced++;
      } catch {
        // Stop on first failure — likely a network issue
        break;
      }
    }

    return synced;
  }

  /**
   * Get stats about the local store.
   */
  stats(): { total: number; unsynced: number } {
    const total = this.store.getTotalCount();
    const unsynced = this.store.getUnsynced(0).length;
    return { total, unsynced };
  }

  /**
   * Hash arbitrary data (utility for external verification).
   */
  static hash(data: unknown): string {
    return hashData(data);
  }

  /**
   * Close the SDK (cleanup database connection).
   */
  close(): void {
    this.store.close();
  }
}
