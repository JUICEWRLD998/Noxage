"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "@/lib/wallet";
import {
  Button,
  Card,
  EmptyState,
  EpochClock,
  EpochProgress,
  ErrorState,
  FillCard,
  PageHeader,
  PrivacySplitView,
  Skeleton,
  Stat,
  TxHashLink,
  WakeMeter,
} from "@/components";
import { useCloseEpoch } from "@/hooks/useCloseEpoch";
import { useEpochStatus } from "@/hooks/useEpochStatus";
import { useFinalizeSettlement } from "@/hooks/useFinalizeSettlement";
import { useOpenEpoch } from "@/hooks/useOpenEpoch";
import { useOperator } from "@/hooks/useOperator";
import { usePrepareSettlement } from "@/hooks/usePrepareSettlement";
import { useFills, type FillLeg } from "@/hooks/useFills";
import { useSettlement, type ResidualSwap } from "@/hooks/useSettlement";
import { epochManagerAbi, EpochStatus, SettlementStatus } from "@/lib/abis";
import { addresses, TOKENS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import styles from "./epoch.module.css";

/** Fill legs are euint64s in confidential (6-decimal) units for both tokens. */
const CONF_DECIMALS = TOKENS.WETH.confidentialDecimals;

type UiStatus = "open" | "closed" | "settling" | "settled" | "failed";

/**
 * Per-user "netted privately" estimate for a settled epoch.
 *
 * Perfect net (no residual swap) → 100: nothing touched the public rail.
 * Otherwise, compare the epoch's public residual (amountIn, denominated in the
 * heavy side's paid token) against the user's own paid leg in that same token:
 *   pct = (1 - residual / userPaid) clamped to [0, 100].
 * If the user paid nothing on the heavy side they were counterflow — their
 * entire flow was absorbed inside the batch → 100. The residual is an
 * epoch-level aggregate, so this is an estimate, never an exact attribution
 * (the caption says so). Integer bigint math; never NaN.
 */
function computeNettedPct(
  legs: FillLeg,
  residualSwap: ResidualSwap | null,
): number {
  if (!residualSwap) return 100;
  const userPaid = residualSwap.buyHeavy ? legs.payQuote : legs.payBase;
  if (userPaid <= 0n) return 100;
  const residual = residualSwap.amountIn;
  if (residual >= userPaid) return 0;
  const pct = Number(((userPaid - residual) * 10_000n) / userPaid) / 100;
  return Math.min(100, Math.max(0, pct));
}

export default function EpochPage() {
  const { isConnected } = useAccount();

  // Active epoch + shared duration (polled).
  const active = useEpochStatus();

  // Latest epoch ever opened — the pager's upper bound and the default view
  // when nothing is currently open.
  const currentQuery = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "currentEpochId",
    query: { refetchInterval: 8_000 },
  });
  const latestId = (currentQuery.data as bigint | undefined) ?? 0n;

  // Viewed epoch: user override via the pager, else active, else latest.
  const [override, setOverride] = useState<bigint | null>(null);
  const defaultId =
    active.activeEpochId && active.activeEpochId > 0n
      ? active.activeEpochId
      : latestId;
  const viewedId = override ?? defaultId;

  // All reads below are keyed by viewedId (arbitrary epoch, not just active).
  const epochQuery = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "getEpoch",
    args: viewedId > 0n ? [viewedId] : undefined,
    query: { enabled: viewedId > 0n, refetchInterval: 8_000 },
  });
  const epoch = epochQuery.data as
    | {
        status: number;
        openedAt: bigint;
        closesAt: bigint;
        closedAt: bigint;
        intentCount: number;
        settlementRef: `0x${string}`;
      }
    | undefined;

  const chainStatus = (epoch?.status ?? EpochStatus.None) as EpochStatus;
  const needsSettlement =
    chainStatus === EpochStatus.Closed ||
    chainStatus === EpochStatus.Settled ||
    chainStatus === EpochStatus.Failed;
  const settlement = useSettlement(
    needsSettlement && viewedId > 0n ? viewedId : undefined,
  );

  const fills = useFills();
  const close = useCloseEpoch();
  const prepare = usePrepareSettlement();
  const finalize = useFinalizeSettlement();
  const operator = useOperator();
  const openEpoch = useOpenEpoch();

  // 1s tick so the "Close epoch" affordance appears exactly when the window
  // expires (EpochClock ticks internally; this drives the page-level gate).
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (chainStatus !== EpochStatus.Open) return;
    const id = setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [chainStatus]);

  const openedAt = Number(epoch?.openedAt ?? 0n);
  const closesAt = Number(epoch?.closesAt ?? 0n);
  const hasRecordedIntents = (epoch?.intentCount ?? 0) > 0;

  const uiStatus: UiStatus = useMemo(() => {
    switch (chainStatus) {
      case EpochStatus.Open:
        return "open";
      case EpochStatus.Closed:
        // Once the operator has prepared the settlement, the batch is netting.
        return settlement.status === SettlementStatus.Prepared
          ? "settling"
          : "closed";
      case EpochStatus.Settled:
        return "settled";
      case EpochStatus.Failed:
        return "failed";
      default:
        return "open"; // unreachable behind the viewedId > 0 guards below
    }
  }, [chainStatus, settlement.status]);

  const expired = chainStatus === EpochStatus.Open && nowSec >= closesAt;

  const userFill = useMemo(
    () => fills.fills.find((f) => f.epochId === viewedId),
    [fills.fills, viewedId],
  );
  const userLegs = userFill
    ? (fills.decrypted[userFill.intentId.toString()] ?? null)
    : null;

  if (!isConnected) {
    return (
      <div>
        <PageHeader
          title="Epoch"
          description="Intents seal into 60-second epochs. The batch nets internally; only the residual touches the public rail."
        />
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet on Sepolia to watch epochs and your sealed fills."
        />
      </div>
    );
  }

  const loadingShell =
    active.isLoading || currentQuery.isLoading || (viewedId > 0n && epochQuery.isLoading);

  const doClose = async () => {
    const ok = await close.closeEpoch(viewedId);
    if (ok) {
      active.refetch();
      void epochQuery.refetch();
    }
  };

  const pager =
    latestId > 1n ? (
      <div className={styles.pager} role="group" aria-label="Browse epochs">
        <Button
          variant="ghost"
          size="sm"
          disabled={viewedId <= 1n}
          onClick={() => setOverride(viewedId - 1n)}
          aria-label="Previous epoch"
        >
          ‹
        </Button>
        <span className={styles.pagerLabel}>
          #{viewedId.toString()} / {latestId.toString()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={viewedId >= latestId}
          onClick={() => setOverride(viewedId + 1n)}
          aria-label="Next epoch"
        >
          ›
        </Button>
      </div>
    ) : undefined;

  return (
    <div>
      <PageHeader
        title="Epoch"
        description="Intents seal into 60-second epochs. The batch nets internally; only the residual touches the public rail."
        actions={pager}
      />

      {loadingShell ? (
        <Card>
          <Skeleton width="40%" height="1.4em" />
          <div className={styles.skeletonGap} />
          <Skeleton width="100%" height="3em" />
        </Card>
      ) : active.error ? (
        <ErrorState
          title="Could not reach the epoch manager"
          description={active.error.message.split("\n")[0]}
        />
      ) : latestId === 0n || viewedId === 0n ? (
        <EmptyState
          title="No epoch is open"
          description={
            operator.isOperator
              ? "Open an epoch to start accepting sealed intents."
              : "An operator opens epochs; check back shortly."
          }
          action={
            operator.isOperator ? (
              <Button
                variant="accent"
                size="sm"
                loading={openEpoch.isPending}
                onClick={async () => {
                  const ok = await openEpoch.openEpoch();
                  if (ok) {
                    void active.refetch();
                    void currentQuery.refetch();
                  }
                }}
              >
                Open epoch
              </Button>
            ) : undefined
          }
        />
      ) : chainStatus === EpochStatus.None ? (
        <EmptyState
          title={`Epoch #${viewedId.toString()} does not exist`}
          description="An operator opens epochs; check back shortly."
        />
      ) : (
        <>
          {/* Lifecycle */}
          <Card className={styles.lifecycleCard}>
            {uiStatus === "open" && (
              <EpochClock
                closesAt={closesAt}
                status="open"
                epochId={viewedId}
                className={styles.clock}
              />
            )}

            <EpochProgress
              status={uiStatus}
              openedAt={openedAt}
              closesAt={closesAt}
              intentCount={epoch?.intentCount ?? 0}
            />

            <div className={styles.statRow}>
              <Stat
                label="Epoch"
                value={<span className={styles.mono}>#{viewedId.toString()}</span>}
              />
              <Stat
                label="Sealed intents"
                value={<span className={styles.mono}>{epoch?.intentCount ?? 0}</span>}
              />
            </div>

            {uiStatus === "open" && expired && (
              <div className={styles.closeRow}>
                <p className={styles.muted}>
                  The window has elapsed. Closing is permissionless — anyone can
                  seal the batch.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={close.isPending}
                  onClick={doClose}
                >
                  {close.stage === "closing" ? "Closing…" : "Close epoch"}
                </Button>
              </div>
            )}
            {close.error && <p className={styles.errorText}>{close.error}</p>}
            {close.stage === "done" && close.lastTx && (
              <div className={styles.txRow}>
                <TxHashLink hash={close.lastTx} label="Closed" />
              </div>
            )}
          </Card>

          {/* Closed / settling */}
          {(uiStatus === "closed" || uiStatus === "settling") && (
            <Card className={styles.settlingCard}>
              {settlement.isLoading ? (
                <Skeleton width="60%" height="1.2em" />
              ) : (
                <>
                  <p className={styles.settlingTitle}>
                    {uiStatus === "settling"
                      ? "Encrypted netting in progress"
                      : !hasRecordedIntents
                        ? "Epoch closed — zero-flow settlement"
                        : "Epoch closed — awaiting netting"}
                  </p>
                  <p className={styles.muted}>
                    {uiStatus === "settling"
                      ? "Buy and sell flow cancels homomorphically over encrypted amounts. Only the aggregate residual will ever be revealed."
                      : !hasRecordedIntents
                        ? "No intents were sealed, so preparation produces a zero residual and finalization closes the epoch without a public swap."
                        : "The batch is sealed. Settlement prepares next: encrypted netting, then the residual (if any) swaps publicly."}
                  </p>
                </>
              )}
              {uiStatus === "closed" &&
                settlement.status === SettlementStatus.None &&
                <div className={styles.closeRow}>
                  <p className={styles.muted}>
                    Homomorphic netting is permissionless — anyone can run
                    prepare once the epoch is closed.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={prepare.isPending}
                    onClick={async () => {
                      const ok = await prepare.prepare(viewedId);
                      if (ok) void settlement.refetch();
                    }}
                  >
                    {prepare.stage === "preparing"
                      ? "Preparing…"
                      : "Prepare settlement"}
                  </Button>
                </div>}
              {prepare.error && (
                <p className={styles.errorText}>{prepare.error}</p>
              )}
              {prepare.stage === "done" && prepare.lastTx && (
                <div className={styles.txRow}>
                  <TxHashLink hash={prepare.lastTx} label="Prepared" />
                </div>
              )}
              {settlement.status === SettlementStatus.Prepared && (
                <div className={styles.closeRow}>
                  <p className={styles.muted}>
                    Residual handles are publicly decryptable. Finalization
                    verifies the signed aggregate before any public swap.
                  </p>
                  {operator.isOperator ? (
                    <Button
                      variant="accent"
                      size="sm"
                      loading={finalize.isPending}
                      onClick={async () => {
                        const ok = await finalize.finalize(viewedId);
                        if (ok) void settlement.refetch();
                      }}
                    >
                      {finalize.stage === "decrypting"
                        ? "Decrypting…"
                        : finalize.stage === "finalizing"
                          ? "Finalizing…"
                          : "Finalize settlement"}
                    </Button>
                  ) : (
                    <p className={styles.muted}>
                      Connect the deployer wallet to finalize settlement.
                    </p>
                  )}
                </div>
              )}
              {finalize.error && (
                <p className={styles.errorText}>{finalize.error}</p>
              )}
              {finalize.stage === "done" && finalize.lastTx && (
                <div className={styles.txRow}>
                  <TxHashLink hash={finalize.lastTx} label="Finalized" />
                </div>
              )}
              {settlement.error && (
                <p className={styles.errorText}>
                  {settlement.error.message.split("\n")[0]}
                </p>
              )}
            </Card>
          )}

          {/* Settled: private vs public */}
          {uiStatus === "settled" && (
            <>
              <PrivacySplitView
                className={styles.split}
                left={
                  fills.isLoading ? (
                    <Skeleton width="100%" height="6em" />
                  ) : userFill ? (
                    <div className={styles.fillStack}>
                      <FillCard
                        intentId={userFill.intentId}
                        epochId={userFill.epochId}
                        legs={userLegs}
                        decrypting={fills.isDecrypting}
                        onDecrypt={() => void fills.decryptFill(userFill.intentId)}
                        baseSymbol={TOKENS.WETH.symbol}
                        quoteSymbol={TOKENS.USDC.symbol}
                        baseDecimals={CONF_DECIMALS}
                        quoteDecimals={CONF_DECIMALS}
                      />
                      <WakeMeter
                        nettedPct={
                          userLegs
                            ? computeNettedPct(userLegs, settlement.residualSwap)
                            : null
                        }
                        caption="of your flow netted privately"
                      />
                      {userLegs && (
                        <p className={styles.estimateNote}>
                          Estimated from your fill vs the public residual.
                        </p>
                      )}
                      {fills.decryptError && (
                        <p className={styles.errorText}>{fills.decryptError}</p>
                      )}
                    </div>
                  ) : (
                    <p className={styles.quietEmpty}>
                      No sealed intent in this epoch.
                    </p>
                  )
                }
                right={
                  settlement.isLoading ? (
                    <Skeleton width="100%" height="6em" />
                  ) : settlement.residualSwap ? (
                    <ResidualPanel
                      swap={settlement.residualSwap}
                      finalizedTxHash={settlement.finalizedTxHash}
                    />
                  ) : (
                    <div className={styles.perfectNet}>
                      <p className={styles.perfectTitle}>Perfect net</p>
                      <p className={styles.muted}>
                        No residual swap. Nothing touched the public rail.
                      </p>
                      {settlement.finalizedTxHash && (
                        <div className={styles.txRow}>
                          <TxHashLink
                            hash={settlement.finalizedTxHash}
                            label="Finalized"
                          />
                        </div>
                      )}
                    </div>
                  )
                }
              />
              {fills.error && (
                <p className={styles.errorText}>
                  {fills.error.message.split("\n")[0]}
                </p>
              )}
              {settlement.error && (
                <p className={styles.errorText}>
                  {settlement.error.message.split("\n")[0]}
                </p>
              )}
            </>
          )}

          {/* Failed */}
          {uiStatus === "failed" && (
            <ErrorState
              title="Residual settlement failed"
              description="On Sepolia this usually means a non-zero residual could not swap publicly (no pool, router mismatch, or empty engine inventory). Perfect-net epochs — equal opposing buy/sell size — are the reliable test path. Funds remain accounted; retry in a new epoch."
              action={
                settlement.finalizedTxHash ? (
                  <TxHashLink
                    hash={settlement.finalizedTxHash}
                    label="Failure tx"
                  />
                ) : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The one public artifact of a settled epoch: the residual Uniswap swap.
 * Buy-heavy → the engine paid quote (mUSDC) for base (mWETH); sell-heavy is
 * the reverse. Amounts are formatted in each public token's native decimals.
 */
function ResidualPanel({
  swap,
  finalizedTxHash,
}: {
  swap: ResidualSwap;
  finalizedTxHash: `0x${string}` | null;
}) {
  const tokenIn = swap.buyHeavy ? TOKENS.USDC : TOKENS.WETH;
  const tokenOut = swap.buyHeavy ? TOKENS.WETH : TOKENS.USDC;

  return (
    <div className={styles.residual}>
      <p className={styles.residualDirection}>
        {swap.buyHeavy ? "Buy-heavy residual" : "Sell-heavy residual"}
      </p>
      <div className={styles.residualRow}>
        <span className={styles.residualLabel}>Swapped in</span>
        <span className={styles.mono}>
          {formatAmount(swap.amountIn, tokenIn.decimals)} {tokenIn.symbol}
        </span>
      </div>
      <div className={styles.residualRow}>
        <span className={styles.residualLabel}>Received</span>
        <span className={styles.mono}>
          {formatAmount(swap.amountOut, tokenOut.decimals)} {tokenOut.symbol}
        </span>
      </div>
      <div className={styles.txRow}>
        <TxHashLink hash={swap.txHash} label="Residual" />
      </div>
      {finalizedTxHash && finalizedTxHash !== swap.txHash && (
        <div className={styles.txRow}>
          <TxHashLink hash={finalizedTxHash} label="Finalized" />
        </div>
      )}
    </div>
  );
}
