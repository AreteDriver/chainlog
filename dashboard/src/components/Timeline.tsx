"use client";

import { useState } from "react";
import type { ActionRecord } from "@/lib/actions";
import { getAgentTimeline, detectAnomalies } from "@/lib/actions";

export function Timeline() {
  const [agentId, setAgentId] = useState("");
  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [anomalies, setAnomalies] = useState<
    { index: number; type: string; detail: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTimeline() {
    if (!agentId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAgentTimeline(agentId.trim());
      setRecords(data);
      setAnomalies(detectAnomalies(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRecords([]);
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadTimeline()}
          placeholder="Enter agent ID..."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={loadTimeline}
          disabled={loading || !agentId.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950 p-3 text-red-300">
          {error}
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950 p-3">
          <h3 className="mb-2 font-medium text-yellow-300">
            Anomalies Detected ({anomalies.length})
          </h3>
          {anomalies.map((a, i) => (
            <div key={i} className="text-sm text-yellow-200">
              <span className="font-mono">#{a.index}</span>{" "}
              <span
                className={
                  a.type === "burst" ? "text-red-400" : "text-orange-400"
                }
              >
                [{a.type}]
              </span>{" "}
              {a.detail}
            </div>
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            {records.length} records (newest first)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-700 text-gray-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Hash</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Submitter</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const isAnomaly = anomalies.some((a) => a.index === i);
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${
                        isAnomaly ? "bg-yellow-950/30" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {records.length - 1 - i}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-400">
                        {r.actionHash.slice(0, 18)}...
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {new Date(r.timestamp * 1000).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {r.submitter.slice(0, 10)}...
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {records.length === 0 && !loading && !error && agentId && (
        <p className="text-gray-500">No records found for this agent.</p>
      )}
    </div>
  );
}
