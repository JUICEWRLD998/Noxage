// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    Nox,
    euint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title NoxageFillLedger
 * @notice Confidential per-intent fill accounting for a settled epoch.
 *
 * When {NoxageSettlementEngine} finalizes an epoch it credits every active
 * intent a fill, expressed as four encrypted legs (all `euint256`, all in the
 * pair's smallest units):
 *
 *   - `recvBase`  — base tokens the user receives (non-zero for buyers)
 *   - `recvQuote` — quote tokens the user receives (non-zero for sellers)
 *   - `payBase`   — base tokens the user gives up  (non-zero for sellers)
 *   - `payQuote`  — quote tokens the user gives up  (non-zero for buyers)
 *
 * Splitting each side into a received and a paid leg keeps every value a
 * non-negative `euint256` (no signed ciphertext needed). The direction stays
 * hidden: a viewer without ACL rights cannot tell which legs are zero.
 *
 * Only the settlement engine may write. Each leg grants the owner Nox viewer
 * access for selective off-chain decryption. Plaintext fills never touch the
 * chain.
 */
contract NoxageFillLedger {
    /// @notice The settlement engine allowed to credit fills. Immutable after set.
    address public engine;

    /// @notice Deployer, allowed to wire the engine exactly once.
    address public immutable deployer;

    struct Fill {
        uint256 epochId;
        address owner;
        bool set;
        euint256 recvBase;
        euint256 recvQuote;
        euint256 payBase;
        euint256 payQuote;
    }

    /// @notice Fill by intent id (an intent settles into at most one fill).
    mapping(uint256 => Fill) private _fills;

    event EngineSet(address indexed engine);
    event FillCredited(uint256 indexed epochId, uint256 indexed intentId, address indexed owner);

    error NotEngine();
    error NotDeployer();
    error ZeroAddress();
    error EngineAlreadySet();
    error FillAlreadyCredited();

    modifier onlyEngine() {
        if (msg.sender != engine) revert NotEngine();
        _;
    }

    constructor() {
        deployer = msg.sender;
    }

    /**
     * @notice Wire the settlement engine once (immutable thereafter).
     * @dev Deployed before the engine, then pointed at it, resolving the
     *      engine↔ledger construction cycle.
     */
    function setEngine(address engine_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (engine_ == address(0)) revert ZeroAddress();
        if (engine != address(0)) revert EngineAlreadySet();
        engine = engine_;
        emit EngineSet(engine_);
    }

    /**
     * @notice Record a confidential fill for `intentId`. Callable only by the
     *         engine, once per intent. Persists ACL access for `owner`.
     * @dev The engine hands over handles it computed this transaction; the
     *      ledger takes persistent custody (`allowThis`) and grants the owner
     *      read access so they can always decrypt their own fill.
     */
    function creditFill(
        uint256 epochId,
        uint256 intentId,
        address owner,
        euint256 recvBase,
        euint256 recvQuote,
        euint256 payBase,
        euint256 payQuote
    ) external onlyEngine {
        if (_fills[intentId].set) revert FillAlreadyCredited();

        Nox.allowThis(recvBase);
        Nox.allowThis(recvQuote);
        Nox.allowThis(payBase);
        Nox.allowThis(payQuote);

        Nox.allow(recvBase, owner);
        Nox.allow(recvQuote, owner);
        Nox.allow(payBase, owner);
        Nox.allow(payQuote, owner);
        Nox.addViewer(recvBase, owner);
        Nox.addViewer(recvQuote, owner);
        Nox.addViewer(payBase, owner);
        Nox.addViewer(payQuote, owner);

        _fills[intentId] = Fill({
            epochId: epochId,
            owner: owner,
            set: true,
            recvBase: recvBase,
            recvQuote: recvQuote,
            payBase: payBase,
            payQuote: payQuote
        });

        emit FillCredited(epochId, intentId, owner);
    }

    // ─────────────────────────────────────────────────────────────
    // Views (handles only — never plaintext)
    // ─────────────────────────────────────────────────────────────

    function getFill(uint256 intentId) external view returns (Fill memory) {
        return _fills[intentId];
    }

    /// @notice Encrypted fill legs for `intentId` (decryptable only via ACL).
    function fillHandles(uint256 intentId)
        external
        view
        returns (euint256 recvBase, euint256 recvQuote, euint256 payBase, euint256 payQuote)
    {
        Fill storage f = _fills[intentId];
        return (f.recvBase, f.recvQuote, f.payBase, f.payQuote);
    }

    function isFilled(uint256 intentId) external view returns (bool) {
        return _fills[intentId].set;
    }
}
