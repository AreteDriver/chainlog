# CLAUDE.md — ChainLog

## Project Overview

Tamper-proof audit trails for AI agents. Writes cryptographic fingerprints of agent actions to Base L2 blockchain. Only the hash goes on-chain — no PII, no sensitive data.

## Current State

- **Version**: 0.1.0
- **Sprint**: 1 (Contract + Tests)
- **Network**: Base Sepolia (testnet)

## Architecture

```
chainlog/
├── contracts/          # Solidity smart contracts
│   └── ChainLog.sol    # Core contract
├── test/               # Hardhat test suite
├── scripts/            # Deployment and utility scripts
├── ignition/modules/   # Hardhat Ignition deploy modules
├── hardhat.config.ts   # Network and compiler config
└── package.json
```

## Tech Stack

- **Language**: Solidity ^0.8.20, TypeScript
- **Framework**: Hardhat 3
- **Testing**: Chai + Hardhat Toolbox
- **Blockchain**: Base L2 (Ethereum)
- **Deploy**: Hardhat Ignition

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

# deploy to Base Sepolia
npm run deploy:sepolia

# deploy to Base mainnet
npm run deploy:mainnet
```

## Coding Standards

- **Solidity**: Minimal surface area, NatSpec comments on all public functions
- **TypeScript**: strict mode, no `any`
- **Tests**: 100% contract coverage target
- **Naming**: camelCase (Solidity/TS), UPPER_CASE for constants

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

## Git Conventions

- Commit messages: Conventional commits (`feat:`, `fix:`, `test:`, `docs:`)
- Run tests before committing
