// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ERC7984ObserverAccess} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ObserverAccess.sol";

/**
 * @title NoxageConfidentialToken
 * @notice Noxage's confidential-balance wrapper for a single public ERC-20.
 *
 * @dev This is the Phase 2 "shield / unshield" primitive. It composes three
 *      audited OpenZeppelin confidential-contract layers on top of Zama's FHEVM
 *      coprocessor (live on Ethereum Sepolia):
 *
 *      - {ERC7984ERC20Wrapper} — wrap (shield) public ERC-20 into an encrypted
 *        `euint64` balance, and unwrap (unshield) back to the public token via a
 *        two-step decrypt-and-finalize flow. Balances and transfer amounts are
 *        stored as ciphertext handles on-chain; plaintext never appears.
 *      - {ERC7984ObserverAccess} — selective disclosure. An account may appoint
 *        one observer that is granted permanent FHE ACL access to that account's
 *        balance and transfer amounts (auditor / delegated viewer). The account
 *        (or the observer, to abdicate) can change it at any time.
 *      - {ZamaEthereumConfig} — wires the ACL / Coprocessor / KMSVerifier
 *        addresses automatically by `block.chainid` (mainnet, Sepolia, local).
 *
 *      Deploy one instance per underlying token (e.g. a confidential USDC and a
 *      confidential WETH). The 1:1 confidential fill/netting logic lives in later
 *      phases; this contract only owns the confidential value rail.
 *
 *      Privacy note: {confidentialBalanceOf} returns a ciphertext handle, not a
 *      cleartext balance. Only the owner (and any appointed observer) hold ACL
 *      rights to decrypt it off-chain via the Zama relayer.
 */
contract NoxageConfidentialToken is
    ERC7984,
    ERC7984ERC20Wrapper,
    ERC7984ObserverAccess,
    ZamaEthereumConfig
{
    constructor(
        IERC20 underlying_,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) ERC7984ERC20Wrapper(underlying_) {}

    // ── Multiple-inheritance disambiguation ──────────────────────────────────
    // `_update` is overridden by both the wrapper (total-supply guard) and the
    // observer extension (grants ACL to observers). Chain both via `super`; C3
    // linearization runs them in reverse declaration order.

    function _update(
        address from,
        address to,
        euint64 amount
    )
        internal
        virtual
        override(ERC7984, ERC7984ERC20Wrapper, ERC7984ObserverAccess)
        returns (euint64 transferred)
    {
        return super._update(from, to, amount);
    }

    function decimals()
        public
        view
        virtual
        override(ERC7984, ERC7984ERC20Wrapper)
        returns (uint8)
    {
        return super.decimals();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC7984, ERC7984ERC20Wrapper) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
