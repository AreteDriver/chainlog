// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainLog — Tamper-proof audit trails for AI agents
/// @notice Writes immutable action fingerprints to Base L2.
///         Only the hash goes on-chain. No PII. No sensitive data.
/// @dev Intentionally minimal surface area for auditability.
contract ChainLog {
    /// @notice Emitted when an action is logged on-chain
    /// @param agentId The agent that performed the action
    /// @param actionHash keccak256 fingerprint of the full action record
    /// @param timestamp Block timestamp when the record was written
    /// @param submitter Address of the SDK wallet that submitted
    event ActionLogged(
        string indexed agentId,
        bytes32 indexed actionHash,
        uint256 timestamp,
        address submitter
    );

    /// @notice Emitted when multiple actions are logged in a single tx
    /// @param agentId The agent that performed the actions
    /// @param count Number of actions in the batch
    /// @param submitter Address of the SDK wallet that submitted
    event BatchLogged(
        string indexed agentId,
        uint256 count,
        address submitter
    );

    struct ActionRecord {
        bytes32 actionHash;
        string metadataURI;
        uint256 timestamp;
        address submitter;
    }

    /// @notice agentId => array of action records
    mapping(string => ActionRecord[]) public agentLogs;

    /// @notice Global action counter
    uint256 public totalActions;

    /// @notice Log a single agent action on-chain
    /// @param agentId Unique identifier for the agent
    /// @param actionHash keccak256 of the full action data
    /// @param metadataURI IPFS or HTTP URI to the full off-chain record
    function logAction(
        string calldata agentId,
        bytes32 actionHash,
        string calldata metadataURI
    ) external {
        agentLogs[agentId].push(
            ActionRecord({
                actionHash: actionHash,
                metadataURI: metadataURI,
                timestamp: block.timestamp,
                submitter: msg.sender
            })
        );
        totalActions++;
        emit ActionLogged(agentId, actionHash, block.timestamp, msg.sender);
    }

    /// @notice Log multiple actions in a single transaction (gas savings)
    /// @param agentId Unique identifier for the agent
    /// @param actionHashes Array of keccak256 hashes
    /// @param metadataURIs Array of metadata URIs (must match length)
    function logBatch(
        string calldata agentId,
        bytes32[] calldata actionHashes,
        string[] calldata metadataURIs
    ) external {
        require(
            actionHashes.length == metadataURIs.length,
            "ChainLog: length mismatch"
        );
        require(actionHashes.length > 0, "ChainLog: empty batch");
        require(actionHashes.length <= 100, "ChainLog: batch too large");

        uint256 ts = block.timestamp;
        address sender = msg.sender;

        for (uint256 i = 0; i < actionHashes.length; i++) {
            agentLogs[agentId].push(
                ActionRecord({
                    actionHash: actionHashes[i],
                    metadataURI: metadataURIs[i],
                    timestamp: ts,
                    submitter: sender
                })
            );
            emit ActionLogged(agentId, actionHashes[i], ts, sender);
        }
        totalActions += actionHashes.length;
        emit BatchLogged(agentId, actionHashes.length, sender);
    }

    /// @notice Get the number of logged actions for an agent
    function getRecordCount(
        string calldata agentId
    ) external view returns (uint256) {
        return agentLogs[agentId].length;
    }

    /// @notice Verify an action hash matches the on-chain record
    /// @param agentId Agent identifier
    /// @param index Index in the agent's log array
    /// @param claimedHash Hash to verify against
    /// @return True if the claimed hash matches the stored hash
    function verifyAction(
        string calldata agentId,
        uint256 index,
        bytes32 claimedHash
    ) external view returns (bool) {
        require(
            index < agentLogs[agentId].length,
            "ChainLog: index out of bounds"
        );
        return agentLogs[agentId][index].actionHash == claimedHash;
    }
}
