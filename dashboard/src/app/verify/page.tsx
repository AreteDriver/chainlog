import { VerifyForm } from "@/components/VerifyForm";

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Verify Action</h1>
        <p className="text-gray-400">
          Verify any local log entry against its on-chain record. If the hash
          matches, the log has not been tampered with since it was written to
          the blockchain.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}
