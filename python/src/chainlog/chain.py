"""On-chain writer for ChainLog contract via web3.py."""

from __future__ import annotations

import logging

from web3 import AsyncWeb3, Web3
from web3.providers import AsyncHTTPProvider

logger = logging.getLogger(__name__)

CHAINLOG_ABI = [
    {
        "inputs": [
            {"name": "agentId", "type": "string"},
            {"name": "actionHash", "type": "bytes32"},
            {"name": "metadataURI", "type": "string"},
        ],
        "name": "logAction",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "agentId", "type": "string"},
            {"name": "actionHashes", "type": "bytes32[]"},
            {"name": "metadataURIs", "type": "string[]"},
        ],
        "name": "logBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "agentId", "type": "string"},
            {"name": "index", "type": "uint256"},
            {"name": "claimedHash", "type": "bytes32"},
        ],
        "name": "verifyAction",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "agentId", "type": "string"}],
        "name": "getRecordCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

BASE_SEPOLIA_RPC = "https://sepolia.base.org"


class ChainWriter:
    """Async on-chain writer for ChainLog contract."""

    def __init__(
        self,
        contract_address: str,
        private_key: str,
        rpc_url: str | None = None,
    ) -> None:
        self._rpc_url = rpc_url or BASE_SEPOLIA_RPC
        self._w3 = AsyncWeb3(AsyncHTTPProvider(self._rpc_url))
        self._account = self._w3.eth.account.from_key(private_key)
        self._contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=CHAINLOG_ABI,
        )

    async def log_action(
        self,
        agent_id: str,
        action_hash: str,
        metadata_uri: str = "",
    ) -> str:
        """Write a single action to the blockchain. Returns tx hash."""
        action_hash_bytes = bytes.fromhex(action_hash[2:])

        tx = await self._contract.functions.logAction(
            agent_id, action_hash_bytes, metadata_uri
        ).build_transaction(
            {
                "from": self._account.address,
                "nonce": await self._w3.eth.get_transaction_count(
                    self._account.address
                ),
            }
        )

        signed = self._account.sign_transaction(tx)
        tx_hash = await self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = await self._w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt["transactionHash"].hex()

    async def verify_action(
        self,
        agent_id: str,
        index: int,
        claimed_hash: str,
    ) -> bool:
        """Verify an action hash against the on-chain record."""
        claimed_bytes = bytes.fromhex(claimed_hash[2:])
        return await self._contract.functions.verifyAction(
            agent_id, index, claimed_bytes
        ).call()

    async def get_record_count(self, agent_id: str) -> int:
        """Get the number of records for an agent."""
        return await self._contract.functions.getRecordCount(agent_id).call()
