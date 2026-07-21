// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NoxageEpochManager
 * @notice Owns the epoch lifecycle for Noxage's confidential intent batching.
 *
 * Users seal encrypted intents (in {NoxageIntentBook}) into whichever epoch is
 * currently open. An operator (owner) opens and closes epochs; once closed, an
 * epoch is sealed for settlement-engine netting and can only move to `Settled`
 * or `Failed`.
 *
 * No plaintext trade data ever touches this contract — it tracks only the epoch
 * state machine and an intent counter for UI/indexing. Encrypted intent handles
 * live in {NoxageIntentBook}.
 *
 * Lifecycle:
 *
 *   None → Open → Closed → Settled
 *                       └→ Failed
 */
contract NoxageEpochManager is Ownable {
    enum EpochStatus {
        None, // 0 — never opened (default for unknown ids)
        Open, // 1 — accepting intents
        Closed, // 2 — sealed; awaiting settlement netting
        Settled, // 3 — residual executed, fills credited
        Failed // 4 — settlement failed; funds must be refunded/credited
    }

    struct Epoch {
        EpochStatus status;
        uint64 openedAt;
        uint64 closedAt;
        uint32 intentCount;
        // Opaque reference to the settlement (e.g. a tx hash or fill-ledger root).
        // Set on settle/fail so the UI can link the on-chain residual.
        bytes32 settlementRef;
    }

    /// @notice Suggested epoch duration in seconds (UI countdown / permissionless close hint).
    uint64 public epochDuration;

    /// @notice Monotonically increasing id of the most recently opened epoch (0 == none yet).
    uint256 public currentEpochId;

    /// @notice The intent book allowed to record intents against open epochs.
    address public intentBook;

    /// @notice Settlement engine allowed to mark closed epochs Settled/Failed.
    ///         Set once when Phase 4 is wired; zero until then (owner can still
    ///         mark settle/fail manually for recovery).
    address public settlementEngine;

    mapping(uint256 => Epoch) private _epochs;

    event EpochOpened(uint256 indexed epochId, uint64 openedAt, uint64 closesAt);
    event EpochClosed(uint256 indexed epochId, uint64 closedAt, uint32 intentCount);
    event EpochSettled(uint256 indexed epochId, bytes32 settlementRef);
    event EpochFailed(uint256 indexed epochId, bytes32 settlementRef);
    event IntentBookSet(address indexed intentBook);
    event SettlementEngineSet(address indexed settlementEngine);
    event EpochDurationSet(uint64 epochDuration);

    error InvalidEpochDuration();
    error EpochNotOpen(uint256 epochId);
    error EpochNotClosed(uint256 epochId);
    error EpochAlreadyOpen(uint256 openEpochId);
    error NotIntentBook();
    error IntentBookNotSet();
    error IntentBookAlreadySet();
    error SettlementEngineAlreadySet();
    error NotSettlementAuthority();
    error ZeroAddress();

    modifier onlyIntentBook() {
        if (msg.sender != intentBook) revert NotIntentBook();
        _;
    }

    /// @dev Owner (ops recovery) or the wired settlement engine may finalize.
    modifier onlySettlementAuthority() {
        if (msg.sender != owner() && msg.sender != settlementEngine) {
            revert NotSettlementAuthority();
        }
        _;
    }

    constructor(address initialOwner, uint64 epochDuration_) Ownable(initialOwner) {
        if (epochDuration_ == 0) revert InvalidEpochDuration();
        epochDuration = epochDuration_;
        emit EpochDurationSet(epochDuration_);
    }

    // ─────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────

    /// @notice Wire the intent book once. Immutable after the first set.
    function setIntentBook(address intentBook_) external onlyOwner {
        if (intentBook_ == address(0)) revert ZeroAddress();
        if (intentBook != address(0)) revert IntentBookAlreadySet();
        intentBook = intentBook_;
        emit IntentBookSet(intentBook_);
    }

    /// @notice Wire the settlement engine once so it can mark Settled/Failed.
    /// @dev Immutable after the first set. Owner retains settle/fail authority
    ///      for manual recovery if the engine reverts mid-path.
    function setSettlementEngine(address settlementEngine_) external onlyOwner {
        if (settlementEngine_ == address(0)) revert ZeroAddress();
        if (settlementEngine != address(0)) revert SettlementEngineAlreadySet();
        settlementEngine = settlementEngine_;
        emit SettlementEngineSet(settlementEngine_);
    }

    /// @notice Update the suggested epoch duration (affects future epochs' hints only).
    function setEpochDuration(uint64 epochDuration_) external onlyOwner {
        if (epochDuration_ == 0) revert InvalidEpochDuration();
        epochDuration = epochDuration_;
        emit EpochDurationSet(epochDuration_);
    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Open a new epoch. Reverts if one is already open, so at most one
     *         epoch accepts intents at a time.
     * @return epochId The id of the newly opened epoch.
     */
    function openEpoch() external onlyOwner returns (uint256 epochId) {
        if (intentBook == address(0)) revert IntentBookNotSet();

        uint256 current = currentEpochId;
        if (current != 0 && _epochs[current].status == EpochStatus.Open) {
            revert EpochAlreadyOpen(current);
        }

        epochId = current + 1;
        currentEpochId = epochId;

        uint64 nowTs = uint64(block.timestamp);
        _epochs[epochId] = Epoch({
            status: EpochStatus.Open,
            openedAt: nowTs,
            closedAt: 0,
            intentCount: 0,
            settlementRef: bytes32(0)
        });

        emit EpochOpened(epochId, nowTs, nowTs + epochDuration);
    }

    /**
     * @notice Close the current open epoch, sealing it for settlement netting.
     * @dev Callable by the owner at any time, or permissionlessly once the
     *      suggested duration has elapsed (keeps the batch cadence honest even
     *      if the operator stalls).
     */
    function closeEpoch(uint256 epochId) external {
        Epoch storage epoch = _epochs[epochId];
        if (epoch.status != EpochStatus.Open) revert EpochNotOpen(epochId);

        bool expired = block.timestamp >= uint256(epoch.openedAt) + epochDuration;
        if (msg.sender != owner() && !expired) revert EpochNotOpen(epochId);

        epoch.status = EpochStatus.Closed;
        epoch.closedAt = uint64(block.timestamp);

        emit EpochClosed(epochId, epoch.closedAt, epoch.intentCount);
    }

    /**
     * @notice Mark a closed epoch as settled once residual settlement has executed.
     * @param settlementRef Opaque pointer to the settlement (tx hash / fill root).
     * @dev Callable by the wired {settlementEngine} (normal path) or the owner
     *      (ops recovery). Reverts if the epoch is not Closed.
     */
    function markSettled(uint256 epochId, bytes32 settlementRef) external onlySettlementAuthority {
        Epoch storage epoch = _epochs[epochId];
        if (epoch.status != EpochStatus.Closed) revert EpochNotClosed(epochId);

        epoch.status = EpochStatus.Settled;
        epoch.settlementRef = settlementRef;

        emit EpochSettled(epochId, settlementRef);
    }

    /**
     * @notice Mark a closed epoch as failed so intents can be refunded/credited.
     * @dev Same authority model as {markSettled}.
     */
    function markFailed(uint256 epochId, bytes32 settlementRef) external onlySettlementAuthority {
        Epoch storage epoch = _epochs[epochId];
        if (epoch.status != EpochStatus.Closed) revert EpochNotClosed(epochId);

        epoch.status = EpochStatus.Failed;
        epoch.settlementRef = settlementRef;

        emit EpochFailed(epochId, settlementRef);
    }

    // ─────────────────────────────────────────────────────────────
    // Intent book hook
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Record that an intent was sealed into `epochId`. Called only by
     *         the intent book, only while the epoch is open.
     * @return intentIndex The 0-based index of this intent within the epoch.
     */
    function recordIntent(uint256 epochId) external onlyIntentBook returns (uint32 intentIndex) {
        Epoch storage epoch = _epochs[epochId];
        if (epoch.status != EpochStatus.Open) revert EpochNotOpen(epochId);

        intentIndex = epoch.intentCount;
        epoch.intentCount = intentIndex + 1;
    }

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return _epochs[epochId];
    }

    function statusOf(uint256 epochId) external view returns (EpochStatus) {
        return _epochs[epochId].status;
    }

    /// @notice True if `epochId` is currently accepting intents.
    function isOpen(uint256 epochId) public view returns (bool) {
        return _epochs[epochId].status == EpochStatus.Open;
    }

    /// @notice The open epoch id, or 0 if none is currently open.
    function activeEpochId() external view returns (uint256) {
        uint256 current = currentEpochId;
        if (current != 0 && _epochs[current].status == EpochStatus.Open) {
            return current;
        }
        return 0;
    }
}
