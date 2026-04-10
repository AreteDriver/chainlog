# ChainLog

Tamper-proof audit trails for AI agents. Verifiable by anyone. Alterable by no one.

Writes cryptographic fingerprints of AI agent actions to Base L2 blockchain. Only the hash goes on-chain — no PII, no sensitive data. Includes TypeScript and Python SDKs, a CLI verifier, and a Next.js dashboard.

## Features

- On-chain audit trail on Base L2 (Ethereum)
- Model version pinning (EU AI Act compliance)
- Dead man's switch for contingency triggers
- TypeScript SDK (31 tests)
- Python SDK (31 tests)
- CLI verifier tool
- Next.js dashboard (live on Vercel)

## Installation

### Contracts
```bash
npm install
npx hardhat compile
```

### TypeScript SDK
```bash
cd sdk && npm install
```

### Python SDK
```bash
cd python && pip install -e .
```

## Usage

### TypeScript
```typescript
import { ChainLog } from '@chainlog/sdk';
const cl = new ChainLog({ rpcUrl, contractAddress });
await cl.log({ action: 'inference', model: 'claude-sonnet-4-6', hash: '...' });
```

### Python
```python
from chainlog import ChainLogClient
cl = ChainLogClient(rpc_url=..., contract_address=...)
cl.log(action="inference", model="claude-sonnet-4-6", hash="...")
```

## Development

```bash
npx hardhat test        # Contract tests
cd sdk && npm test      # TS SDK tests
cd python && pytest     # Python SDK tests
cd cli && npm test      # CLI tests
```

## Status

Sprint 6 complete. Dashboard live on Vercel. Contracts pending mainnet deploy (needs funded Base Sepolia wallet).

## License

Proprietary
