// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title NoxageHello
 * @notice Phase 0 compile sanity check. Not a product contract.
 * @dev Replaced by vault / intent / epoch / settlement contracts in Phases 2–4.
 */
contract NoxageHello {
    string public constant NAME = "Noxage";
    string public constant TAGLINE = "Public liquidity. Private strategy.";

    uint256 public immutable deployedAt;

    event Bootstrapped(address indexed deployer, uint256 timestamp);

    constructor() {
        deployedAt = block.timestamp;
        emit Bootstrapped(msg.sender, block.timestamp);
    }

    function version() external pure returns (string memory) {
        return "0.0.0-phase0";
    }
}
