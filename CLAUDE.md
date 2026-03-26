# CLAUDE.md — ChainLog

## Project Overview

Tamper-proof audit trails for AI agents. Writes cryptographic fingerprints of agent actions to Base L2 blockchain. Only the hash goes on-chain — no PII, no sensitive data.

## Current State

- **Version**: 0.2.0
- **Sprint**: 6 (Model Version Pinning + Dead Man's Switch)
- **Network**: Base Sepolia (testnet)
- **Contracts**: 3 (ChainLog, ModelVersionRegistry, DeadMansSwitch)
- **Tests**: 74 contract + 31 SDK (TS) + 31 SDK (Python) + 11 CLI = 147 total

## Architecture

```
chainlog/
├── contracts/          # Solidity smart contracts
│   ├── ChainLog.sol              # Core audit trail contract
│   ├── ModelVersionRegistry.sol  # Model version pinning (EU AI Act compliance)
│   └── DeadMansSwitch.sol        # Unstoppable contingency trigger
├── test/               # Hardhat test suite (74 tests)
├── sdk/                # TypeScript SDK (31 tests)
│   └── src/            # chainlog.ts, hasher.ts, store.ts, chain.ts, types.ts
├── python/             # Python SDK (31 tests)
│   └── src/chainlog/   # client.py, hasher.py, store.py, chain.py, types.py
├── cli/                # CLI verifier tool (11 tests)
│   └── src/            # index.ts, contract.ts, hasher.ts, abi.ts
├── dashboard/          # Next.js dashboard (Vercel)
│   └── src/            # app/, components/, lib/
├── scripts/            # Deployment and utility scripts
├── ignition/modules/   # Hardhat Ignition deploy modules
├── hardhat.config.ts   # Network and compiler config
└── package.json
```

## Tech Stack

- **Language**: Solidity ^0.8.20, TypeScript, Python
- **Framework**: Hardhat 2, vitest, pytest, Next.js 16
- **Blockchain**: Base L2 (Ethereum)
- **Python deps**: web3.py >=7.0.0
- **Dashboard**: RainbowKit + wagmi + ethers.js + Tailwind
- **Deploy**: Hardhat Ignition, Vercel (dashboard)

## Common Commands

```bash
# compile contracts
npm run compile

# run tests
npm test

# run tests with gas reporting
npm run test:gas

# coverage
npm run coverage

# deploy ChainLog to Base Sepolia/mainnet
npm run deploy:sepolia
npm run deploy:mainnet

# deploy ModelVersionRegistry
npm run deploy:registry:sepolia
npm run deploy:registry:mainnet

# deploy DeadMansSwitch (edit ignition/params/dms.json first!)
npm run deploy:dms:sepolia
npm run deploy:dms:mainnet

# Python SDK
cd python && pip install -e ".[dev]"
python -m pytest tests/ -v
ruff check src/ tests/ && ruff format src/ tests/

# CLI
cd cli && npm install && npm test
chainlog -c 0x... verify -a agent-1 -i 0 -h 0x...
chainlog -c 0x... inspect -a agent-1 -i 0
chainlog -c 0x... count -a agent-1
chainlog -c 0x... stats
chainlog hash -d '{"hello":"world"}'

# Deploy to Base Sepolia (requires DEPLOYER_PRIVATE_KEY)
./scripts/deploy.sh
```

## Coding Standards

- **Solidity**: Minimal surface area, NatSpec comments on all public functions
- **TypeScript**: strict mode, no `any`
- **Tests**: 100% contract coverage target
- **Python**: ruff lint + format, type hints, snake_case
- **Naming**: camelCase (Solidity/TS), snake_case (Python), UPPER_CASE for constants

## Anti-Patterns (Do NOT Do)

- Do NOT store PII on-chain — hash everything
- Do NOT use unbounded loops in contract functions
- Do NOT commit `.env` or private keys
- Do NOT deploy to mainnet without full test coverage
- Do NOT use `latest` Solidity — pin version
- Do NOT skip NatSpec on public/external functions

## Contract Design Principles

- Minimal surface = minimal attack surface
- Events over storage where possible (cheaper gas)
- Batch operations capped at 100 to prevent gas limit issues
- No admin functions, no upgradability — immutable by design
- State updates BEFORE value transfers (reentrancy prevention — always)
- Run Slither static analysis before ANY mainnet deployment

## Core Invariants (Never Violate)

1. `logAction()` is append-only. No delete, no update functions. Ever.
2. Hash construction: `keccak256(abi.encodePacked(agentId, actionType, inputHash, outputHash, modelId, timestamp))` — field order is canonical, never change it.
3. SDK write is always async and non-blocking. Agent execution must never wait for chain confirmation.
4. Raw PII never goes on-chain. Hash it first. Always.
5. Protocol fee (if added) routes to treasury address set at deploy time — never modifiable post-deploy.
6. `DeadMansSwitch.execute()` fires exactly once. `triggered` flag set BEFORE ETH transfer.
7. `DeadMansSwitch` has no pause, no cancel, no upgrade. Once deployed, it fires or it doesn't.
8. `ModelVersionRegistry.pinVersion()` is append-only. Pins are never deleted or updated.
9. Model version pins distinguish trust level via `pinMethod` field: PROVIDER_HASH, PROXY_FINGERPRINT, or SELF_ATTESTED.

## Domain Context

### Key Classes
- `ChainLog` — Core audit trail contract + SDK client class (TS and Python)
- `ModelVersionRegistry` — Model version pinning contract (EU AI Act Article 13)
- `DeadMansSwitch` — Heartbeat-based contingency trigger contract
- `ChainWriter` — Async on-chain writer (web3.py / ethers.js)
- `LocalStore` — SQLite WAL write-ahead buffer
- `ActionRecord` — Canonical action data structure (hashed for on-chain)
- `PinRecord` — Model version pin record (modelHash, pinMethod, metadata, timestamp, operator)

### Key Constants
- `BASE_SEPOLIA_RPC` — `https://sepolia.base.org`
- `BASE_MAINNET_RPC` — `https://mainnet.base.org`
- `CHAINLOG_ABI` — Minimal contract ABI (logAction, verifyAction, getRecordCount)
- `MODEL_REGISTRY_ABI` — Registry ABI (pinVersion, getLatestPin, verifyPin, getPins)
- `DMS_ABI` — Switch ABI (heartbeat, execute, timeRemaining, isExpired)

### Environment Variables
- `DEPLOYER_PRIVATE_KEY` — Wallet key for contract deployment
- `CHAINLOG_CONTRACT_ADDRESS` — Deployed contract address
- `CHAINLOG_PRIVATE_KEY` — Wallet key for SDK chain writes
- `CHAINLOG_RPC_URL` — Custom RPC endpoint (optional)
- `NEXT_PUBLIC_CHAINLOG_CONTRACT` — Contract address for dashboard
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID

## Frontend Dev Tools

- **Agentation** (`npm install agentation`): Dev-only React component for visual feedback to Claude Code. Click/annotate dashboard elements → structured markdown → paste to agent.
- **Liveline**: Single-canvas React chart (60fps, zero deps). Candidate for audit trail timeline and action frequency visualization on the dashboard.

## Git Conventions

- Commit messages: Conventional commits (`feat:`, `fix:`, `test:`, `docs:`)
- Run tests before committing
