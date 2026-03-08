#!/usr/bin/env bash
# Deploy ChainLog contract to Base Sepolia or mainnet.
#
# Prerequisites:
#   - DEPLOYER_PRIVATE_KEY env var set (funded wallet)
#   - npm ci (root) already run
#
# Usage:
#   ./scripts/deploy.sh              # deploys to Base Sepolia
#   ./scripts/deploy.sh mainnet      # deploys to Base mainnet

set -euo pipefail

NETWORK="${1:-baseSepolia}"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "ERROR: DEPLOYER_PRIVATE_KEY env var not set"
  echo ""
  echo "To deploy, you need a funded wallet on Base ${NETWORK}."
  echo "  1. Create a wallet (e.g. via MetaMask)"
  echo "  2. Fund it with ETH on Base Sepolia (faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)"
  echo "  3. Export the private key:"
  echo "     export DEPLOYER_PRIVATE_KEY=0x..."
  echo ""
  exit 1
fi

echo "Deploying ChainLog to ${NETWORK}..."
echo ""

# Compile first
npx hardhat compile

# Deploy via Ignition
npx hardhat ignition deploy ignition/modules/ChainLog.ts \
  --network "${NETWORK}" \
  --deployment-id "chainlog-${NETWORK}"

echo ""
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Copy the contract address from above"
echo "  2. Set it in your environment:"
echo "     export CHAINLOG_CONTRACT_ADDRESS=0x..."
echo "  3. Test with the CLI:"
echo "     cd cli && npx tsx src/index.ts -c 0x... stats"
