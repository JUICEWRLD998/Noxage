"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWriteContract } from "@/lib/wallet";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FillCard,
  PageHeader,
  Skeleton,
  buttonClassName,
} from "@/components";
import { useEpochStatus } from "@/hooks/useEpochStatus";
import { useFills } from "@/hooks/useFills";
import { useIntents, type OwnedIntent } from "@/hooks/useIntents";
import { useTxToast } from "@/hooks/useTxToast";
import { EpochStatus, IntentStatus, intentBookAbi } from "@/lib/abis";
import { TOKENS, addresses } from "@/lib/contracts";
import styles from "./fills.module.css";

// Fill legs are euint64 confidential units (ERC7984 wrapper caps at 6 decimals),
// not the underlying ERC-20 decimals.
const BASE = TOKENS.WETH;
const QUOTE = TOKENS.USDC;

export default function FillsPage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const fillsApi = useFills();
  const intentsApi = useIntents();
  const epoch = useEpochStatus();

  /** Which fill's Decrypt is in flight (the hook's stage is global). */
  const [decryptingId, setDecryptingId] = useState<bigint | null>(null);
  /** Intent queued for cancellation — non-null opens the confirm dialog. */
  const [cancelTarget, setCancelTarget] = useState<OwnedIntent | null>(null);
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);

  const filledIds = new Set(fillsApi.fills.map((f) => f.intentId.toString()));

  if (!isConnected) {
    return (
      <div>
        <PageHeader
          title="Fills"
          description="Your settled fills, sealed until you decrypt them. The chain is the source of truth — history survives refresh."
        />
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet on Sepolia to view your fills and intent history."
        />
      </div>
    );
  }

  const doDecrypt = async (intentId: bigint) => {
    setDecryptingId(intentId);
    try {
      await fillsApi.decryptFill(intentId);
    } finally {
      setDecryptingId(null);
    }
  };

  const isCancellable = (intent: OwnedIntent) =>
    intent.status === IntentStatus.Active &&
    epoch.activeEpochId !== undefined &&
    intent.epochId === epoch.activeEpochId &&
    epoch.status === EpochStatus.Open;

  const doCancel = async (intent: OwnedIntent) => {
    setCancelTarget(null);
    if (!publicClient) return;
    setCancellingId(intent.intentId);
    try {
      toast.info(
        "Cancelling intent",
        `Removing intent #${intent.intentId.toString()} from the epoch.`,
      );
      const tx = await writeContractAsync({
        address: addresses.intentBook,
        abi: intentBookAbi,
        functionName: "cancelIntent",
        args: [intent.intentId],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      toast.success(
        "Intent cancelled",
        `Intent #${intent.intentId.toString()} left the epoch before close.`,
      );
      void intentsApi.refetch();
    } catch (err) {
      toast.error(
        "Cancel failed",
        err instanceof Error ? err.message.split("\n")[0] : undefined,
      );
    } finally {
      setCancellingId(null);
    }
  };

  const exportHashRefs = async () => {
    // Public data only: ids and the ledger address. Amounts stay sealed.
    const lines = [
      `Noxage fill refs — ledger ${addresses.fillLedger}`,
      ...fillsApi.fills.map(
        (f) =>
          `intent #${f.intentId.toString()} · epoch #${f.epochId.toString()}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(
        "Hash refs copied",
        "Public refs only — no amounts included.",
      );
    } catch {
      toast.error("Copy failed", "Clipboard access was denied.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Fills"
        description="Your settled fills, sealed until you decrypt them. The chain is the source of truth — history survives refresh."
      />

      {/* Fills */}
      <section className={styles.section} aria-labelledby="fills-heading">
        <div className={styles.sectionHeader}>
          <h2 id="fills-heading" className={styles.sectionTitle}>
            Fills
          </h2>
          {fillsApi.fills.length > 0 && (
            <Button variant="ghost" size="sm" onClick={exportHashRefs}>
              Export hash refs
            </Button>
          )}
        </div>

        {fillsApi.isLoading ? (
          <div className={styles.skeletonGrid}>
            <Skeleton height="180px" />
            <Skeleton height="180px" />
          </div>
        ) : fillsApi.error ? (
          <ErrorState
            title="Couldn't load fills"
            description="Reading FillCredited logs from Sepolia failed. Retrying automatically."
          />
        ) : fillsApi.fills.length === 0 ? (
          <EmptyState
            title="No fills yet"
            description="Fills appear here after your epoch settles. Shield tokens, seal an intent, and wait for the epoch to close."
            action={
              <Link
                href="/app/shield"
                className={buttonClassName("secondary", "sm")}
              >
                Shield tokens
              </Link>
            }
          />
        ) : (
          <div className={styles.fillsGrid}>
            {fillsApi.fills.map((fill) => (
              <FillCard
                key={fill.intentId.toString()}
                intentId={fill.intentId}
                epochId={fill.epochId}
                legs={fillsApi.decrypted[fill.intentId.toString()] ?? null}
                decrypting={
                  fillsApi.isDecrypting && decryptingId === fill.intentId
                }
                onDecrypt={() => void doDecrypt(fill.intentId)}
                baseSymbol={BASE.symbol}
                quoteSymbol={QUOTE.symbol}
                baseDecimals={BASE.confidentialDecimals}
                quoteDecimals={QUOTE.confidentialDecimals}
              />
            ))}
          </div>
        )}
        {fillsApi.decryptError && (
          <p className={styles.errorText}>{fillsApi.decryptError}</p>
        )}
      </section>

      {/* Intent history */}
      <section className={styles.section} aria-labelledby="intents-heading">
        <div className={styles.sectionHeader}>
          <h2 id="intents-heading" className={styles.sectionTitle}>
            Intent history
          </h2>
        </div>

        {intentsApi.isLoading ? (
          <div className={styles.skeletonRows}>
            <Skeleton height="2.2em" />
            <Skeleton height="2.2em" />
            <Skeleton height="2.2em" />
          </div>
        ) : intentsApi.error ? (
          <ErrorState
            title="Couldn't load intents"
            description="Reading IntentSubmitted logs from Sepolia failed. Retrying automatically."
          />
        ) : intentsApi.intents.length === 0 ? (
          <EmptyState
            title="No sealed intents yet"
            action={
              <Link
                href="/app/intent"
                className={buttonClassName("secondary", "sm")}
              >
                Submit an intent
              </Link>
            }
          />
        ) : (
          <ul className={styles.intentList} role="list">
            {intentsApi.intents.map((intent) => {
              const settled = filledIds.has(intent.intentId.toString());
              return (
                <li key={intent.intentId.toString()} className={styles.intentRow}>
                  <span className={styles.intentId}>
                    #{intent.intentId.toString()}
                  </span>
                  <span className={styles.intentEpoch}>
                    epoch #{intent.epochId.toString()}
                  </span>
                  {settled ? (
                    <Badge variant="success">Settled</Badge>
                  ) : intent.status === IntentStatus.Cancelled ? (
                    <Badge variant="default">Cancelled</Badge>
                  ) : (
                    <Badge variant="accent">Sealed</Badge>
                  )}
                  <span className={styles.intentDeadline}>
                    {new Date(Number(intent.deadline) * 1000).toLocaleString()}
                  </span>
                  {isCancellable(intent) && !settled && (
                    <span className={styles.intentActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={cancellingId === intent.intentId}
                        onClick={() => setCancelTarget(intent)}
                      >
                        Cancel
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={`Cancel sealed intent #${cancelTarget?.intentId.toString() ?? ""}?`}
        description="This removes it from the epoch before it closes."
        confirmLabel="Cancel intent"
        tone="danger"
        onConfirm={() => {
          if (cancelTarget) void doCancel(cancelTarget);
        }}
      />
    </div>
  );
}
