"use client";

import { useState } from "react";
import { verifyAction } from "@/lib/actions";

export function VerifyForm() {
  const [agentId, setAgentId] = useState("");
  const [index, setIndex] = useState("");
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify() {
    if (!agentId || !index || !hash) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const valid = await verifyAction(agentId.trim(), parseInt(index), hash.trim());
      setResult(valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-400">Agent ID</label>
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="e.g. forge-builder"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-400">
          Record Index
        </label>
        <input
          type="number"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          placeholder="0"
          min="0"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-400">
          Action Hash (0x-prefixed)
        </label>
        <input
          type="text"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          placeholder="0xabc123..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 font-mono text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || !agentId || !index || !hash}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Verifying..." : "Verify On-Chain"}
      </button>

      {result === true && (
        <div className="rounded-lg border border-green-700 bg-green-950 p-4 text-center">
          <p className="text-lg font-bold text-green-400">VERIFIED</p>
          <p className="text-sm text-green-300">
            This action hash matches the on-chain record. The log has not been
            tampered with.
          </p>
        </div>
      )}

      {result === false && (
        <div className="rounded-lg border border-red-700 bg-red-950 p-4 text-center">
          <p className="text-lg font-bold text-red-400">MISMATCH</p>
          <p className="text-sm text-red-300">
            This hash does NOT match the on-chain record. The log may have been
            altered.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
