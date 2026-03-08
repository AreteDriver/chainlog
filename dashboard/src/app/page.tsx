import { Timeline } from "@/components/Timeline";

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Agent Timeline</h1>
        <p className="text-gray-400">
          View chronological on-chain audit trail for any AI agent. Enter an
          agent ID to load its action history from the Base blockchain.
        </p>
      </div>
      <Timeline />
    </div>
  );
}
