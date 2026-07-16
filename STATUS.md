# Project Status

| Attribute | Value |
|-----------|-------|
| Status | **PARTIAL** |
| Last verified | 2026-07-16 |
| Installable? | Partial — SDKs installable, contracts need Hardhat/Foundry |
| Tested? | TypeScript SDK: 31 tests; Python SDK: 31 tests; contract tests via Hardhat |
| Documented? | README + inline SDK docs; no hosted docs |

## What Works

- **Smart Contracts:** Deployed and verified on Base L2 (Ethereum L2)
- **TypeScript SDK:** `npm install @chainlog/sdk` — log hashes, verify trails
- **Python SDK:** `pip install chainlog` — same capabilities
- **CLI Verifier:** Standalone tool for third-party verification without SDK
- **Dashboard:** Next.js app deployed on Vercel for browsing audit trails
- **Model Version Pinning:** EU AI Act compliance metadata support

## What Doesn't Work Yet

- No automated contract deployment pipeline
- Dashboard is functional but not publicly marketed
- Dead man's switch is implemented but not battle-tested in production
- No formal security audit of contracts

## Install

```bash
# TypeScript SDK
cd sdk && npm install

# Python SDK
cd python && pip install -e .

# Contracts
cd contracts && npm install && npx hardhat compile
```

## Relationship to Animus

Chainlog provides the cryptographic audit trail layer for Animus. Every Forge workflow execution, citizen proposal, and eval run can be fingerprinted and logged on-chain for tamper-proof evidence.
