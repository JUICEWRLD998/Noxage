// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FHE, ebool, euint8, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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
 *   1. {prepareSettlement} — nets every active intent **homomorphically**. Using
 *      the encrypted `side`, it splits each encrypted `amount` into a buy leg and
 *      a sell leg (`FHE.select`) and accumulates encrypted buy/sell totals. It
 *      then computes the encrypted residual `|buy − sell|` and a direction bit,
 *      and makes **only those two aggregates** publicly decryptable. Individual
 *      sizes and directions are never revealed — only the batch residual, which
 *      is public by design (it is the flow that hits Uniswap).
 *
 *   2. Off-chain, anyone calls the Zama relayer `publicDecrypt` on the two
 *      revealed handles (mirrors the shield/unshield finalize flow).
 *
 *   3. {finalizeSettlement} — verifies the KMS-signed cleartext residual
 *      (`FHE.checkSignatures`), swaps **the residual only** on the unmodified
 *      Uniswap v3 router from the engine's own inventory, then credits every
 *      active intent an encrypted fill at the public clearing price into
 *      {NoxageFillLedger}, and marks the epoch `Settled`. A reverting residual
 *      swap routes the epoch to `Failed` with no fills credited.
 *
 * Trust / privacy: the engine is granted FHE ACL access to intent handles by the
 * intent book, so it can net the batch. It learns only the aggregate residual —
 * never any individual amount. See docs/THREAT-MODEL.md.
 */
contract NoxageSettlementEngine is ZamaEthereumConfig, Ownable {
    using SafeERC20 for IERC20;

    NoxageEpochManager public immutable epochManager;
    NoxageIntentBook public immutable intentBook;
    NoxageFillLedger public immutable fillLedger;
    ISwapRouter public immutable swapRouter;

    /// @notice Public underlying tokens of the (single) supported pair.
    IERC20 public immutable baseToken;
    IERC20 public immutable quoteToken;

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
        euint64 residualHandle; // |buy − sell| in base units
        euint64 dirHandle; // 1 == buy-heavy (net buy base), 0 == sell-heavy
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
    error NoActiveIntents(uint256 epochId);
    error InvalidPrice();
    error ZeroAddress();

    constructor(
        address initialOwner,
        address epochManager_,
        address intentBook_,
        address fillLedger_,
        address swapRouter_,
        address baseToken_,
        address quoteToken_,
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
        poolFee = poolFee_;
        emit PoolFeeSet(poolFee_);
    }

    /// @notice Update the Uniswap fee tier for future residual swaps.
    function setPoolFee(uint24 poolFee_) external onlyOwner {
        poolFee = poolFee_;
        emit PoolFeeSet(poolFee_);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 1 — homomorphic netting + residual reveal
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Net a closed epoch's intents and reveal only the aggregate
     *         residual + direction for off-chain decryption.
     * @dev Callable by anyone once the epoch is closed — the reveal exposes no
     *      individual data, and the finalize step is KMS-gated. Idempotent guard
     *      via {SettlementStatus}.
     */
    function prepareSettlement(uint256 epochId) external {
        if (epochManager.statusOf(epochId) != NoxageEpochManager.EpochStatus.Closed) {
            revert EpochNotClosed(epochId);
        }
        Settlement storage s = _settlements[epochId];
        if (s.status != SettlementStatus.None) revert AlreadyPrepared(epochId);

        uint256[] memory ids = intentBook.epochIntentIds(epochId);

        euint64 buyTotal = FHE.asEuint64(0);
        euint64 sellTotal = FHE.asEuint64(0);
        euint64 zero = FHE.asEuint64(0);

        uint256 active;
        for (uint256 i = 0; i < ids.length; i++) {
            NoxageIntentBook.Intent memory intent = intentBook.getIntent(ids[i]);
            if (intent.status != NoxageIntentBook.IntentStatus.Active) continue;
            active++;

            // side == 1 → buy base; side == 0 → sell base.
            ebool isBuy = FHE.eq(intent.side, uint8(1));
            buyTotal = FHE.add(buyTotal, FHE.select(isBuy, intent.amount, zero));
            sellTotal = FHE.add(sellTotal, FHE.select(isBuy, zero, intent.amount));
        }
        if (active == 0) revert NoActiveIntents(epochId);

        // Residual = |buy − sell|; both subtraction branches are computed but the
        // select discards the underflowing one. dir = 1 when buyers dominate.
        ebool buyHeavy = FHE.gt(buyTotal, sellTotal);
        euint64 residual = FHE.select(
            buyHeavy,
            FHE.sub(buyTotal, sellTotal),
            FHE.sub(sellTotal, buyTotal)
        );
        euint64 dir = FHE.select(buyHeavy, FHE.asEuint64(1), zero);

        // Reveal ONLY these two aggregates. Persist their public-decryptability
        // and this contract's access so finalize can verify them next tx.
        FHE.makePubliclyDecryptable(residual);
        FHE.makePubliclyDecryptable(dir);
        FHE.allowThis(residual);
        FHE.allowThis(dir);

        s.status = SettlementStatus.Prepared;
        s.residualHandle = residual;
        s.dirHandle = dir;

        emit SettlementPrepared(epochId, FHE.toBytes32(residual), FHE.toBytes32(dir));
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2 — verify residual, swap on Uniswap, credit fills
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Finalize a prepared epoch: verify the KMS-signed residual, swap it
     *         on Uniswap, and credit encrypted fills at the clearing price.
     * @param epochId          The prepared epoch.
     * @param residualBase     KMS-decrypted residual, in base units.
     * @param buyHeavy         KMS-decrypted direction (true == net buy base).
     * @param priceNum         Clearing price numerator   (quote units).
     * @param priceDen         Clearing price denominator (base units). price =
     *                         priceNum/priceDen = quote per 1 base unit.
     * @param amountOutMinimum Slippage floor for the residual swap.
     * @param decryptionProof  KMS signatures over (residualBase, buyHeavy).
     *
     * The (residualBase, buyHeavy) pair is checked against the handles revealed
     * in {prepareSettlement} via {FHE-checkSignatures}, so a caller cannot forge
     * the residual. `priceNum/priceDen` is the public clearing price (derived
     * off-chain from the residual's Uniswap execution or an oracle); only the
     * price is public — per-user fills stay encrypted.
     */
    function finalizeSettlement(
        uint256 epochId,
        uint64 residualBase,
        bool buyHeavy,
        uint64 priceNum,
        uint64 priceDen,
        uint256 amountOutMinimum,
        bytes calldata decryptionProof
    ) external onlyOwner {
        Settlement storage s = _settlements[epochId];
        if (s.status != SettlementStatus.Prepared) revert NotPrepared(epochId);
        if (priceNum == 0 || priceDen == 0) revert InvalidPrice();

        // Verify the revealed residual + direction were KMS-signed for the exact
        // handles we published in prepare. Reverts on any mismatch/forgery.
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(s.residualHandle);
        handles[1] = FHE.toBytes32(s.dirHandle);
        FHE.checkSignatures(
            handles,
            abi.encode(residualBase, buyHeavy ? uint64(1) : uint64(0)),
            decryptionProof
        );

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
                        deadline: block.timestamp,
                        amountIn: amountIn,
                        amountOutMinimum: amountOutMinimum,
                        sqrtPriceLimitX96: 0
                    })
                )
            returns (uint256 amountOut) {
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
     *      price. Each fill is four non-negative `euint64` legs; the encrypted
     *      side keeps the buyer/seller split hidden. Returns the number filled.
     */
    function _creditFills(
        uint256 epochId,
        uint64 priceNum,
        uint64 priceDen
    ) private returns (uint256 filled) {
        uint256[] memory ids = intentBook.epochIntentIds(epochId);
        euint64 zero = FHE.asEuint64(0);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 intentId = ids[i];
            NoxageIntentBook.Intent memory intent = intentBook.getIntent(intentId);
            if (intent.status != NoxageIntentBook.IntentStatus.Active) continue;

            // quote leg = amount * price, at the public clearing price.
            euint64 quoteLeg = FHE.div(FHE.mul(intent.amount, priceNum), priceDen);
            ebool isBuy = FHE.eq(intent.side, uint8(1));

            // Buyer: receives base, pays quote. Seller: receives quote, pays base.
            euint64 recvBase = FHE.select(isBuy, intent.amount, zero);
            euint64 payQuote = FHE.select(isBuy, quoteLeg, zero);
            euint64 recvQuote = FHE.select(isBuy, zero, quoteLeg);
            euint64 payBase = FHE.select(isBuy, zero, intent.amount);

            // Hand transient access to the ledger so it can take custody + grant
            // the owner persistent ACL.
            address ledger = address(fillLedger);
            FHE.allowTransient(recvBase, ledger);
            FHE.allowTransient(recvQuote, ledger);
            FHE.allowTransient(payBase, ledger);
            FHE.allowTransient(payQuote, ledger);

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
    function withdraw(IERC20 token, address to, uint256 amount) external onlyOwner {
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
