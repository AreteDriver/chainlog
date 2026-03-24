// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeadMansSwitch — Unstoppable contingency trigger for AI operators
/// @notice Owner periodically calls heartbeat(). If the heartbeat stops for
///         expiryWindow seconds, anyone can call execute() to transfer the
///         contract's ETH balance to the beneficiary. Once triggered, it is
///         irreversible and the contract is permanently dead.
/// @dev No pause. No cancel. No upgradeability. Once deployed, it fires or it doesn't.
///      This is the point — a centralized dead man's switch can be disabled by the
///      party who might want to disable it. On-chain, no one can.
contract DeadMansSwitch {
    /// @notice Emitted when the switch is triggered after expiry
    /// @param caller Address that called execute()
    /// @param beneficiary Address that received the funds
    /// @param amount ETH amount transferred
    /// @param timestamp Block timestamp when triggered
    event SwitchTriggered(
        address indexed caller,
        address indexed beneficiary,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted on each heartbeat
    /// @param timestamp Block timestamp of the heartbeat
    event Heartbeat(uint256 timestamp);

    /// @notice Emitted when ETH is deposited to the contract
    /// @param sender Address that sent ETH
    /// @param amount Amount of ETH received
    event Funded(address indexed sender, uint256 amount);

    /// @notice Contract owner — only address that can heartbeat
    address public immutable owner;

    /// @notice Recipient of funds when switch triggers
    address payable public immutable beneficiary;

    /// @notice Seconds of silence before the switch can fire
    uint256 public immutable expiryWindow;

    /// @notice Timestamp of the last heartbeat (or deploy time)
    uint256 public lastHeartbeat;

    /// @notice Whether execute() has been called
    bool public triggered;

    /// @param _beneficiary Address to receive funds on trigger
    /// @param _expiryWindow Seconds until switch can fire (e.g. 259200 = 72 hours)
    constructor(address payable _beneficiary, uint256 _expiryWindow) {
        require(_beneficiary != address(0), "DeadMansSwitch: zero beneficiary");
        require(_expiryWindow >= 3600, "DeadMansSwitch: expiry too short"); // minimum 1 hour
        require(_expiryWindow <= 365 days, "DeadMansSwitch: expiry too long");

        owner = msg.sender;
        beneficiary = _beneficiary;
        expiryWindow = _expiryWindow;
        lastHeartbeat = block.timestamp;
    }

    /// @notice Reset the dead man's timer. Only callable by owner.
    function heartbeat() external {
        require(msg.sender == owner, "DeadMansSwitch: not owner");
        require(!triggered, "DeadMansSwitch: already triggered");

        lastHeartbeat = block.timestamp;
        emit Heartbeat(block.timestamp);
    }

    /// @notice Execute the switch — transfers all ETH to beneficiary.
    ///         Callable by anyone after the expiry window has passed.
    ///         Can only fire once.
    function execute() external {
        require(!triggered, "DeadMansSwitch: already triggered");
        require(
            block.timestamp >= lastHeartbeat + expiryWindow,
            "DeadMansSwitch: not expired"
        );

        // State update BEFORE transfer (reentrancy prevention)
        triggered = true;
        uint256 amount = address(this).balance;

        // Use call instead of transfer (2300 gas limit breaks multisig/smart wallets)
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "DeadMansSwitch: transfer failed");

        emit SwitchTriggered(msg.sender, beneficiary, amount, block.timestamp);
    }

    /// @notice Seconds remaining until the switch can fire.
    ///         Returns 0 if already expired or triggered.
    function timeRemaining() external view returns (uint256) {
        if (triggered) return 0;
        uint256 deadline = lastHeartbeat + expiryWindow;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    /// @notice Whether the switch is currently expired (can be executed)
    function isExpired() external view returns (bool) {
        if (triggered) return false;
        return block.timestamp >= lastHeartbeat + expiryWindow;
    }

    /// @notice Accept ETH deposits. Only before trigger.
    receive() external payable {
        require(!triggered, "DeadMansSwitch: already triggered");
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Reject calls to nonexistent functions
    fallback() external payable {
        revert("DeadMansSwitch: invalid call");
    }
}
