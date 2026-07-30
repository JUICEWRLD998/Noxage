// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    Nox,
    ebool,
    euint256
} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NoxageEpochManager} from "./NoxageEpochManager.sol";
import {NoxageIntentBook} from "./NoxageIntentBook.sol";
import {NoxageFillLedger} from "./NoxageFillLedger.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/**
 * @title NoxageSettlementEngine
 * @notice Phase 4 — the confidential netting + residual settlement core.
 *
 * For one closed epoch of a single pair (BASE/QUOTE), the engine:
 *
 *   1. {prepareSettlement} - nets every active intent confidentially. Using
 *      the encrypted `side`, it splits each encrypted `amount` into a buy leg and
 *      a sell leg (`Nox.select`) and accumulates encrypted buy/sell totals. It
 *      then computes the encrypted residual `|buy − sell|` and a direction bit,
 *      and makes **only those two aggregates** publicly decryptable. Individual
 *      sizes and directions are never revealed — only the batch residual, which
 *      is public by design (it is the flow that hits Uniswap).
 *
 *   2. Off-chain, anyone calls the Nox handle SDK `publicDecrypt` on each
 *      revealed handle.
 *
 *   3. {finalizeSettlement} — verifies the Nox public-decryption proofs
 *      (`Nox.publicDecrypt`), swaps **the residual only** on the unmodified
 *      Uniswap v3 router from the engine's own inventory, then credits every
 *      active intent an encrypted fill at the public clearing price into
 *      {NoxageFillLedger}, and marks the epoch `Settled`. A reverting residual
 *      swap routes the epoch to `Failed` with no fills credited.
 *
 * Trust / privacy: the engine is granted Nox ACL access to intent handles by the
 * intent book, so it can net the batch. It learns only the aggregate residual —
 * never any individual amount. See docs/THREAT-MODEL.md.
 */
contract NoxageSettlementEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    NoxageEpochManager public immutable epochManager;
    NoxageIntentBook public immutable intentBook;
    NoxageFillLedger public immutable fillLedger;
    ISwapRouter public immutable swapRouter;

    /// @notice Public underlying tokens of the (single) supported pair.
    IERC20 public immutable baseToken;
    IERC20 public immutable quoteToken;
    bytes32 public immutable supportedPair;

    /// @notice Uniswap v3 fee tier used for the residual leg (e.g. 3000 = 0.3%).
    uint24 public poolFee;

    enum SettlementStatus {
        None, // 0 — not started
        Prepared, // 1 — residual revealed; awaiting off-chain decrypt + finalize
        Settled, // 2 — residual swapped, fills credited
        Failed // 3 — residual swap reverted
    }

    struct Settlement {
        SettlementStatus status;
        // Handles revealed in prepare, verified in finalize (never plaintext).
        euint256 residualHandle; // |buy - sell| in base units
        ebool dirHandle; // true == buy-heavy (net buy base)
    }

    mapping(uint256 => Settlement) private _settlements;

    event SettlementPrepared(uint256 indexed epochId, bytes32 residualHandle, bytes32 dirHandle);
    event ResidualSwapped(
        uint256 indexed epochId,
        bool buyHeavy,
        uint256 amountIn,
        uint256 amountOut
    );
    event SettlementFinalized(uint256 indexed epochId, uint256 filledIntents, bytes32 settlementRef);
    event SettlementFailedEvent(uint256 indexed epochId, bytes32 settlementRef);
    event PoolFeeSet(uint24 poolFee);

    error EpochNotClosed(uint256 epochId);
    error AlreadyPrepared(uint256 epochId);
    error NotPrepared(uint256 epochId);
    error InvalidPrice();
    error UnsupportedPair(bytes32 pair);
    error ZeroAddress();

    constructor(
        address initialOwner,
        address epochManager_,
        address intentBook_,
        address fillLedger_,
        address swapRouter_,
        address baseToken_,
        address quoteToken_,
        bytes32 supportedPair_,
        uint24 poolFee_
    ) Ownable(initialOwner) {
        if (
            epochManager_ == address(0) ||
            intentBook_ == address(0) ||
            fillLedger_ == address(0) ||
            swapRouter_ == address(0) ||
            baseToken_ == address(0) ||
            quoteToken_ == address(0)
        ) revert ZeroAddress();

        epochManager = NoxageEpochManager(epochManager_);
        intentBook = NoxageIntentBook(intentBook_);
        fillLedger = NoxageFillLedger(fillLedger_);
        swapRouter = ISwapRouter(swapRouter_);
        baseToken = IERC20(baseToken_);
        quoteToken = IERC20(quoteToken_);
        supportedPair = supportedPair_;
        poolFee = poolFee_;
        emit PoolFeeSet(poolFee_);
    }

    /// @notice Update the Uniswap fee tier for future residual swaps.
    function setPoolFee(uint24 poolFee_) external onlyOwner {
        poolFee = poolFee_;
        emit PoolFeeSet(poolFee_);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 1 — confidential netting + residual reveal
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Net a closed epoch's intents and reveal only the aggregate
     *         residual + direction for off-chain decryption.
     * @dev Callable by anyone once the epoch is closed — the reveal exposes no
     *      individual data, and finalization is proof-gated. Idempotent guard
     *      via {SettlementStatus}.
     */
    function prepareSettlement(uint256 epochId) external {
        if (epochManager.statusOf(epochId) != NoxageEpochManager.EpochStatus.Closed) {
            revert EpochNotClosed(epochId);
        }
        Settlement storage s = _settlements[epochId];
        if (s.status != SettlementStatus.None) revert AlreadyPrepared(epochId);

        uint256[] memory ids = intentBook.epochIntentIds(epochId);
        uint64 closedAt = epochManager.getEpoch(epochId).closedAt;

        euint256 buyTotal = Nox.toEuint256(0);
        euint256 sellTotal = Nox.toEuint256(0);
        euint256 zero = Nox.toEuint256(0);

        for (uint256 i = 0; i < ids.length; i++) {
            NoxageIntentBook.Intent memory intent = intentBook.getIntent(ids[i]);
            if (intent.status != NoxageIntentBook.IntentStatus.Active) continue;
            if (intent.pair != supportedPair) revert UnsupportedPair(intent.pair);
            if (intent.deadline < closedAt) continue;

            buyTotal = Nox.add(buyTotal, Nox.select(intent.side, intent.amount, zero));
            sellTotal = Nox.add(sellTotal, Nox.select(intent.side, zero, intent.amount));
        }
        // Residual = |buy − sell|; both subtraction branches are computed but the
        // select discards the underflowing one. dir = 1 when buyers dominate.
        ebool buyHeavy = Nox.gt(buyTotal, sellTotal);
        euint256 residual = Nox.select(
            buyHeavy,
            Nox.sub(buyTotal, sellTotal),
            Nox.sub(sellTotal, buyTotal)
        );

        Nox.allowThis(residual);
        Nox.allowThis(buyHeavy);
        Nox.allowPublicDecryption(residual);
        Nox.allowPublicDecryption(buyHeavy);

        s.status = SettlementStatus.Prepared;
        s.residualHandle = residual;
        s.dirHandle = buyHeavy;

        emit SettlementPrepared(epochId, euint256.unwrap(residual), ebool.unwrap(buyHeavy));
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2 — verify residual, swap on Uniswap, credit fills
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Finalize a prepared epoch: verify the Nox-decrypted residual, swap it
     *         on Uniswap, and credit encrypted fills at the clearing price.
     * @param epochId          The prepared epoch.
     * @param priceNum         Clearing price numerator   (quote units).
     * @param priceDen         Clearing price denominator (base units). price =
     *                         priceNum/priceDen = quote per 1 base unit.
     * @param amountOutMinimum Slippage floor for the residual swap.
     * @param residualProof    Nox proof for the public residual handle.
     * @param directionProof   Nox proof for the public direction handle.
     *
     * The clear values are derived from the handles revealed in
     * {prepareSettlement} via {Nox-publicDecrypt}, so a caller cannot forge
     * the residual. `priceNum/priceDen` is the public clearing price (derived
     * off-chain from the residual's Uniswap execution or an oracle); only the
     * price is public — per-user fills stay encrypted.
     */
    function finalizeSettlement(
        uint256 epochId,
        uint64 priceNum,
        uint64 priceDen,
        uint256 amountOutMinimum,
        bytes calldata residualProof,
        bytes calldata directionProof
    ) external onlyOwner nonReentrant {
        Settlement storage s = _settlements[epochId];
        if (s.status != SettlementStatus.Prepared) revert NotPrepared(epochId);
        if (priceNum == 0 || priceDen == 0) revert InvalidPrice();

        uint256 residualBase = Nox.publicDecrypt(s.residualHandle, residualProof);
        bool buyHeavy = Nox.publicDecrypt(s.dirHandle, directionProof);

        bytes32 ref = keccak256(abi.encodePacked(epochId, residualBase, buyHeavy, block.number));

        // Swap the residual only, from the engine's inventory, on the unmodified
        // Uniswap router. A revert routes the epoch to Failed (no fills credited).
        if (residualBase > 0) {
            (IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn) = buyHeavy
                ? (quoteToken, baseToken, (uint256(residualBase) * priceNum) / priceDen)
                : (baseToken, quoteToken, uint256(residualBase));

            tokenIn.forceApprove(address(swapRouter), amountIn);
            try
                swapRouter.exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: address(tokenIn),
                        tokenOut: address(tokenOut),
                        fee: poolFee,
                        recipient: address(this),
                        amountIn: amountIn,
                        amountOutMinimum: amountOutMinimum,
                        sqrtPriceLimitX96: 0
                    })
                )
            returns (uint256 amountOut) {
                tokenIn.forceApprove(address(swapRouter), 0);
                emit ResidualSwapped(epochId, buyHeavy, amountIn, amountOut);
            } catch {
                tokenIn.forceApprove(address(swapRouter), 0);
                s.status = SettlementStatus.Failed;
                epochManager.markFailed(epochId, ref);
                emit SettlementFailedEvent(epochId, ref);
                return;
            }
        }

        uint256 filled = _creditFills(epochId, priceNum, priceDen);

        s.status = SettlementStatus.Settled;
        epochManager.markSettled(epochId, ref);
        emit SettlementFinalized(epochId, filled, ref);
    }

    /**
     * @dev Credit every active intent an encrypted fill at the public clearing
     *      price. Each fill is four non-negative `euint256` legs; the encrypted
     *      side keeps the buyer/seller split hidden. Returns the number filled.
     */
    function _creditFills(
        uint256 epochId,
        uint64 priceNum,
        uint64 priceDen
    ) private returns (uint256 filled) {
        uint256[] memory ids = intentBook.epochIntentIds(epochId);
        uint64 closedAt = epochManager.getEpoch(epochId).closedAt;
        euint256 zero = Nox.toEuint256(0);
        euint256 encryptedPriceNum = Nox.toEuint256(priceNum);
        euint256 encryptedPriceDen = Nox.toEuint256(priceDen);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 intentId = ids[i];
            NoxageIntentBook.Intent memory intent = intentBook.getIntent(intentId);
            if (intent.status != NoxageIntentBook.IntentStatus.Active) continue;
            if (intent.pair != supportedPair) revert UnsupportedPair(intent.pair);
            if (intent.deadline < closedAt) continue;

            // quote leg = amount * price, at the public clearing price.
            euint256 quoteLeg = Nox.div(
                Nox.mul(intent.amount, encryptedPriceNum),
                encryptedPriceDen
            );

            // Buyer: receives base, pays quote. Seller: receives quote, pays base.
            euint256 recvBase = Nox.select(intent.side, intent.amount, zero);
            euint256 payQuote = Nox.select(intent.side, quoteLeg, zero);
            euint256 recvQuote = Nox.select(intent.side, zero, quoteLeg);
            euint256 payBase = Nox.select(intent.side, zero, intent.amount);

            // Hand transient access to the ledger so it can take custody + grant
            // the owner persistent ACL.
            address ledger = address(fillLedger);
            Nox.allowTransient(recvBase, ledger);
            Nox.allowTransient(recvQuote, ledger);
            Nox.allowTransient(payBase, ledger);
            Nox.allowTransient(payQuote, ledger);

            fillLedger.creditFill(
                epochId,
                intentId,
                intent.owner,
                recvBase,
                recvQuote,
                payBase,
                payQuote
            );
            filled++;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Inventory (batch-executor working capital) — see THREAT-MODEL
    // ─────────────────────────────────────────────────────────────

    /// @notice Withdraw engine inventory (owner-only ops function).
    function withdraw(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
    }

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function getSettlement(uint256 epochId) external view returns (Settlement memory) {
        return _settlements[epochId];
    }

    function settlementStatus(uint256 epochId) external view returns (SettlementStatus) {
        return _settlements[epochId].status;
    }
}
