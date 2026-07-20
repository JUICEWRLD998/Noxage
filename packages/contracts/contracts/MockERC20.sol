// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";

/**
 * @title MockERC20
 * @notice Public ERC-20 faucet stand-in for Sepolia (USDC / WETH proxies).
 * @dev Implements ERC-1363 so it can be shielded in a single `transferAndCall`
 *      into the confidential wrapper (which implements `IERC1363Receiver`).
 *      Anyone can `faucet()` test liquidity — this is a testnet token, not a
 *      production asset.
 */
contract MockERC20 is ERC1363 {
    uint8 private immutable _decimals;

    /// @dev Per-call faucet cap so a single account can top up repeatedly for demos.
    uint256 public constant FAUCET_AMOUNT = 10_000;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint `FAUCET_AMOUNT` whole tokens (scaled by decimals) to the caller.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT * 10 ** _decimals);
    }

    /// @notice Mint an explicit raw amount to `to` (test convenience).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
