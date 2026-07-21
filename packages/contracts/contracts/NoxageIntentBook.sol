// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, euint8, euint64, externalEuint8, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {NoxageEpochManager} from "./NoxageEpochManager.sol";

/**
 * @title NoxageIntentBook
 * @notice Accepts confidential trade intents and seals them into the currently
 *         open epoch of {NoxageEpochManager}.
 *
 * An intent's sensitive fields are submitted as FHE ciphertext handles produced
 * client-side and verified on-chain via {FHE-fromExternal}:
 *
 *   - `side`   euint8  — 0 = sell base / 1 = buy base (direction, encrypted)
 *   - `amount` euint64 — size in base-token units (encrypted)
 *   - `limit`  euint64 — optional limit price; encrypted 0 means "no limit"
 *
 * The trading `pair` and `deadline` are public by design (the token pair of any
 * residual flow is visible anyway; see the privacy claims in implementation.md).
 * Amounts, directions, and limits never appear in plaintext on-chain or in events.
 *
 * ACL: the submitter and this contract are granted persistent FHE access to each
 * handle. The Phase 4 settlement engine is granted access when it is wired, so
 * it can homomorphically net the batch without learning any individual size.
 */
contract NoxageIntentBook is ZamaEthereumConfig {
    NoxageEpochManager public immutable epochManager;

    enum IntentStatus {
        None, // 0 — never existed
        Active, // 1 — sealed into an epoch
        Cancelled // 2 — withdrawn by owner while the epoch was open
    }

    struct Intent {
        address owner;
        uint256 epochId;
        bytes32 pair; // public market id, e.g. keccak256("mWETH/mUSDC")
        uint64 deadline; // public unix deadline
        IntentStatus status;
        euint8 side; // encrypted direction
        euint64 amount; // encrypted size
        euint64 limit; // encrypted limit price (0 == none)
    }

    /// @notice All intents by id (ids are globally unique and monotonically increasing).
    mapping(uint256 => Intent) private _intents;

    /// @notice Intent ids sealed into a given epoch, in submission order.
    mapping(uint256 => uint256[]) private _epochIntents;

    uint256 public intentCount;

    /// @notice Settlement engine granted FHE ACL access to intent handles so it
    ///         can net the batch. Set once by the epoch manager's owner before
    ///         epochs open. Zero until wired.
    address public settlementEngine;

    event IntentSubmitted(
        uint256 indexed intentId,
        uint256 indexed epochId,
        address indexed owner,
        bytes32 pair,
        uint64 deadline
    );
    event IntentCancelled(uint256 indexed intentId, uint256 indexed epochId, address indexed owner);
    event SettlementEngineSet(address indexed settlementEngine);

    error NoOpenEpoch();
    error DeadlineInPast();
    error NotIntentOwner();
    error IntentNotActive();
    error EpochNotOpenForCancel();
    error NotOwner();
    error ZeroAddress();
    error SettlementEngineAlreadySet();

    constructor(address epochManager_) {
        epochManager = NoxageEpochManager(epochManager_);
    }

    /**
     * @notice Wire the settlement engine once. Callable only by the epoch
     *         manager's owner; immutable after the first set. Intents submitted
     *         after this grant the engine ACL access to their encrypted fields.
     */
    function setSettlementEngine(address settlementEngine_) external {
        if (msg.sender != epochManager.owner()) revert NotOwner();
        if (settlementEngine_ == address(0)) revert ZeroAddress();
        if (settlementEngine != address(0)) revert SettlementEngineAlreadySet();
        settlementEngine = settlementEngine_;
        emit SettlementEngineSet(settlementEngine_);
    }

    /**
     * @notice Submit a confidential intent into the currently open epoch.
     * @param pair       Public market identifier for the residual pair.
     * @param deadline   Public unix timestamp after which the intent is stale.
     * @param sideExt    Encrypted direction handle (externalEuint8).
     * @param amountExt  Encrypted size handle (externalEuint64).
     * @param limitExt   Encrypted limit-price handle (externalEuint64; 0 == none).
     * @param inputProof Single input proof covering all encrypted handles.
     * @return intentId  The globally unique id of the new intent.
     */
    function submitIntent(
        bytes32 pair,
        uint64 deadline,
        externalEuint8 sideExt,
        externalEuint64 amountExt,
        externalEuint64 limitExt,
        bytes calldata inputProof
    ) external returns (uint256 intentId) {
        if (deadline <= block.timestamp) revert DeadlineInPast();

        // Bind to the currently open epoch (reverts if none is open).
        uint256 epochId = epochManager.activeEpochId();
        if (epochId == 0) revert NoOpenEpoch();

        // Verify each ciphertext against the proof, turning external handles into
        // usable in-contract handles.
        euint8 side = FHE.fromExternal(sideExt, inputProof);
        euint64 amount = FHE.fromExternal(amountExt, inputProof);
        euint64 limit = FHE.fromExternal(limitExt, inputProof);

        // Grant persistent ACL access: this contract (for later settlement wiring)
        // and the submitter (so they can always decrypt their own intent).
        FHE.allowThis(side);
        FHE.allowThis(amount);
        FHE.allowThis(limit);
        FHE.allow(side, msg.sender);
        FHE.allow(amount, msg.sender);
        FHE.allow(limit, msg.sender);

        // Grant the settlement engine access so it can net this intent in-epoch.
        address engine = settlementEngine;
        if (engine != address(0)) {
            FHE.allow(side, engine);
            FHE.allow(amount, engine);
            FHE.allow(limit, engine);
        }

        intentId = ++intentCount;
        _intents[intentId] = Intent({
            owner: msg.sender,
            epochId: epochId,
            pair: pair,
            deadline: deadline,
            status: IntentStatus.Active,
            side: side,
            amount: amount,
            limit: limit
        });
        _epochIntents[epochId].push(intentId);

        // Count it against the epoch (reverts if the epoch is no longer open).
        epochManager.recordIntent(epochId);

        emit IntentSubmitted(intentId, epochId, msg.sender, pair, deadline);
    }

    /**
     * @notice Cancel an active intent while its epoch is still open.
     * @dev Once the epoch closes it is sealed for settlement and cannot be
     *      cancelled. The encrypted fields are left in place (harmless) but the
     *      status flips so netting skips it.
     */
    function cancelIntent(uint256 intentId) external {
        Intent storage intent = _intents[intentId];
        if (intent.owner != msg.sender) revert NotIntentOwner();
        if (intent.status != IntentStatus.Active) revert IntentNotActive();
        if (!epochManager.isOpen(intent.epochId)) revert EpochNotOpenForCancel();

        intent.status = IntentStatus.Cancelled;
        emit IntentCancelled(intentId, intent.epochId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // Views (handles only — never plaintext)
    // ─────────────────────────────────────────────────────────────

    function getIntent(uint256 intentId) external view returns (Intent memory) {
        return _intents[intentId];
    }

    /// @notice Encrypted field handles for `intentId` (decryptable only via ACL).
    function intentHandles(uint256 intentId)
        external
        view
        returns (euint8 side, euint64 amount, euint64 limit)
    {
        Intent storage intent = _intents[intentId];
        return (intent.side, intent.amount, intent.limit);
    }

    /// @notice All intent ids sealed into `epochId`, in submission order.
    function epochIntentIds(uint256 epochId) external view returns (uint256[] memory) {
        return _epochIntents[epochId];
    }

    /// @notice Number of intents (active + cancelled) recorded for `epochId`.
    function epochIntentCount(uint256 epochId) external view returns (uint256) {
        return _epochIntents[epochId].length;
    }
}
