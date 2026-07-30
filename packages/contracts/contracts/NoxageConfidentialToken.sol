// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    Nox,
    euint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {
    ERC20ToERC7984Wrapper
} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";

/**
 * @title NoxageConfidentialToken
 * @notice Noxage's confidential-balance wrapper for a single public ERC-20.
 *
 * @dev This is the Phase 2 "shield / unshield" primitive implemented with the
 *      iExec Nox ERC-20 to ERC-7984 wrapper:
 *
 *      - {ERC20ToERC7984Wrapper} - wrap public ERC-20 into an encrypted
 *        `euint256` balance, and unwrap back to the public token via a
 *        two-step decrypt-and-finalize flow. Balances and transfer amounts are
 *        stored as ciphertext handles on-chain; plaintext never appears.
 *
 *      Deploy one instance per underlying token (e.g. a confidential USDC and a
 *      confidential WETH). The 1:1 confidential fill/netting logic lives in later
 *      phases; this contract only owns the confidential value rail.
 *
 *      Privacy note: {confidentialBalanceOf} returns a ciphertext handle, not a
 *      cleartext balance. The balance owner can decrypt it off-chain via the
 *      Nox handle SDK.
 */
contract NoxageConfidentialToken is ERC20ToERC7984Wrapper {
    mapping(address account => address viewer) private _observers;

    event ObserverSet(address indexed account, address indexed observer);

    error ObserverUnauthorizedAccount(address account, address caller);

    constructor(
        IERC20 underlying_,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC20ToERC7984Wrapper(name_, symbol_, tokenURI_, underlying_) {}

    /**
     * @notice Select a viewer for balance handles created by future updates.
     * @dev Nox viewer grants on existing handles are additive and cannot be
     *      revoked. Setting zero stops granting the viewer access to new handles.
     */
    function setObserver(address account, address newObserver) external {
        if (msg.sender != account) {
            revert ObserverUnauthorizedAccount(account, msg.sender);
        }
        _observers[account] = newObserver;
        emit ObserverSet(account, newObserver);
    }

    function observer(address account) external view returns (address) {
        return _observers[account];
    }

    function _update(
        address from,
        address to,
        euint256 amount
    ) internal virtual override returns (euint256 transferred) {
        transferred = super._update(from, to, amount);
        if (from != address(0)) {
            _grantObserver(from);
        }
        if (to != address(0) && to != from) {
            _grantObserver(to);
        }
    }

    function _grantObserver(address account) private {
        euint256 balance = confidentialBalanceOf(account);
        Nox.addViewer(balance, account);

        address viewer = _observers[account];
        if (viewer != address(0)) {
            Nox.addViewer(balance, viewer);
        }
    }
}
