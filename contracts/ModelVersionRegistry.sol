// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ModelVersionRegistry — Tamper-proof model version pinning
/// @notice Records immutable attestations of which model version an operator
///         was using at a specific point in time. Append-only, no admin functions.
/// @dev Designed for EU AI Act Article 13 compliance. Pairs with ChainLog
///      to create a verifiable audit chain: inference → ChainLog → model pin.
contract ModelVersionRegistry {
    /// @notice Emitted when an operator pins a model version
    /// @param operator The wallet that made the attestation
    /// @param modelIdHash keccak256 of the modelId string (indexed for lookup)
    /// @param modelId Human-readable model identifier
    /// @param modelHash Hash of the model weights, config, or proxy fingerprint
    /// @param pinMethod How the modelHash was derived (PROVIDER_HASH, PROXY_FINGERPRINT, SELF_ATTESTED)
    /// @param timestamp Block timestamp of the pin
    event VersionPinned(
        address indexed operator,
        bytes32 indexed modelIdHash,
        string modelId,
        bytes32 modelHash,
        string pinMethod,
        string metadata,
        uint256 timestamp
    );

    struct PinRecord {
        bytes32 modelHash;
        string pinMethod;
        string metadata;
        uint256 timestamp;
        address operator;
    }

    /// @notice keccak256(modelId) => operator => array of pin records
    mapping(bytes32 => mapping(address => PinRecord[])) private pins;

    /// @notice Global pin counter
    uint256 public totalPins;

    /// @notice Pin a model version — records that at this timestamp, the operator
    ///         attests that modelId resolved to modelHash
    /// @param modelId Human-readable model identifier (e.g. "claude-sonnet-4-5-20251001")
    /// @param modelHash Hash of model weights, system prompt fingerprint, or config
    /// @param pinMethod How modelHash was derived: "PROVIDER_HASH", "PROXY_FINGERPRINT", or "SELF_ATTESTED"
    /// @param metadata JSON string with additional context (optional, can be empty)
    function pinVersion(
        string calldata modelId,
        bytes32 modelHash,
        string calldata pinMethod,
        string calldata metadata
    ) external {
        require(bytes(modelId).length > 0, "ModelVersionRegistry: empty modelId");
        require(modelHash != bytes32(0), "ModelVersionRegistry: zero hash");
        require(bytes(pinMethod).length > 0, "ModelVersionRegistry: empty pinMethod");

        bytes32 modelIdHash = keccak256(abi.encodePacked(modelId));

        pins[modelIdHash][msg.sender].push(
            PinRecord({
                modelHash: modelHash,
                pinMethod: pinMethod,
                metadata: metadata,
                timestamp: block.timestamp,
                operator: msg.sender
            })
        );
        totalPins++;

        emit VersionPinned(
            msg.sender,
            modelIdHash,
            modelId,
            modelHash,
            pinMethod,
            metadata,
            block.timestamp
        );
    }

    /// @notice Get the most recent pin for an operator + modelId pair
    /// @param modelId The model identifier string
    /// @param operator The operator's wallet address
    /// @return The most recent PinRecord
    function getLatestPin(
        string calldata modelId,
        address operator
    ) external view returns (PinRecord memory) {
        bytes32 modelIdHash = keccak256(abi.encodePacked(modelId));
        PinRecord[] storage records = pins[modelIdHash][operator];
        require(records.length > 0, "ModelVersionRegistry: no pins found");
        return records[records.length - 1];
    }

    /// @notice Verify whether an operator ever pinned a specific hash for a model
    /// @param modelId The model identifier string
    /// @param modelHash The hash to verify
    /// @param operator The operator's wallet address
    /// @return True if any pin exists with this exact modelHash
    function verifyPin(
        string calldata modelId,
        bytes32 modelHash,
        address operator
    ) external view returns (bool) {
        bytes32 modelIdHash = keccak256(abi.encodePacked(modelId));
        PinRecord[] storage records = pins[modelIdHash][operator];
        for (uint256 i = 0; i < records.length; i++) {
            if (records[i].modelHash == modelHash) {
                return true;
            }
        }
        return false;
    }

    /// @notice Get paginated pin history for an operator + modelId pair
    /// @param modelId The model identifier string
    /// @param operator The operator's wallet address
    /// @param offset Starting index (0-based)
    /// @param limit Maximum number of records to return
    /// @return records Array of PinRecords (may be shorter than limit)
    /// @return total Total number of pins for this operator + modelId
    function getPins(
        string calldata modelId,
        address operator,
        uint256 offset,
        uint256 limit
    ) external view returns (PinRecord[] memory records, uint256 total) {
        bytes32 modelIdHash = keccak256(abi.encodePacked(modelId));
        PinRecord[] storage allRecords = pins[modelIdHash][operator];
        total = allRecords.length;

        if (offset >= total) {
            return (new PinRecord[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;

        records = new PinRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            records[i] = allRecords[offset + i];
        }
    }

    /// @notice Get the total number of pins for an operator + modelId pair
    /// @param modelId The model identifier string
    /// @param operator The operator's wallet address
    /// @return Number of pin records
    function getPinCount(
        string calldata modelId,
        address operator
    ) external view returns (uint256) {
        bytes32 modelIdHash = keccak256(abi.encodePacked(modelId));
        return pins[modelIdHash][operator].length;
    }
}
