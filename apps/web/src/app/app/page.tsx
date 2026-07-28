"use client";

import Link from "next/link";
import { useAccount } from "@/lib/wallet";
import { Badge, Button, Card, PageHeader, Skeleton, Stat } from "@/components";
import { useEpochStatus } from "@/hooks/useEpochStatus";
import { useOpenEpoch } from "@/hooks/useOpenEpoch";
import { useOperator } from "@/hooks/useOperator";
import { EpochStatus } from "@/lib/abis";
import styles from "./overview.module.css";

const STATUS_LABEL: Record<EpochStatus, string> = {
  [EpochStatus.None]: "None",
  [EpochStatus.Open]: "Open",
  [EpochStatus.Closed]: "Closed",
  [EpochStatus.Settled]: "Settled",
  [EpochStatus.Failed]: "Failed",
};

export default function AppOverview() {
  const { isConnected } = useAccount();
  const { hasOpenEpoch, activeEpochId, status, intentCount, isLoading, error, refetch } =
    useEpochStatus();
  const operator = useOperator();
  const openEpoch = useOpenEpoch();

  return (
    <div>
      <PageHeader
        title="Noxage"
        description="Public liquidity. Private strategy. Shield value, then seal encrypted intents into an epoch."
      />

      <div className={styles.grid}>
        <Link href="/app/shield" className={styles.tile}>
          <Card>
            <h3 className={styles.tileTitle}>Shield →</h3>
            <p className={styles.tileBody}>
              Wrap a public ERC-20 into a confidential balance. Amounts become
              encrypted handles on-chain.
            </p>
          </Card>
        </Link>

        <Link href="/app/intent" className={styles.tile}>
          <Card>
            <h3 className={styles.tileTitle}>Submit intent →</h3>
            <p className={styles.tileBody}>
              Encrypt size, direction, and limit locally, then seal them into the
              open epoch. Only the pair is public.
            </p>
          </Card>
        </Link>

        <Link href="/app/epoch" className={styles.tile}>
          <Card>
            <h3 className={styles.tileTitle}>Watch the epoch →</h3>
            <p className={styles.tileBody}>
              Follow the batch from open to settled, then compare your private
              fill against the public residual.
            </p>
          </Card>
        </Link>

        <Link href="/app/fills" className={styles.tile}>
          <Card>
            <h3 className={styles.tileTitle}>Decrypt fills →</h3>
            <p className={styles.tileBody}>
              Your settled fills stay sealed until you sign. History comes from
              the chain, not this browser.
            </p>
          </Card>
        </Link>
      </div>

      <div className={styles.statsRow}>
        <Card>
          {isLoading ? (
            <div className={styles.stats} aria-busy="true">
              <Skeleton width="7rem" height="3.25rem" />
              <Skeleton width="7rem" height="3.25rem" />
              <Skeleton width="7rem" height="3.25rem" />
            </div>
          ) : error ? (
            <p className={styles.hint} role="alert">
              Couldn’t reach the epoch manager. Retrying automatically.
            </p>
          ) : (
            <div className={styles.stats}>
              <Stat
                label="Open epoch"
                value={hasOpenEpoch ? `#${activeEpochId?.toString()}` : "None"}
              />
              <Stat label="Status" value={STATUS_LABEL[status] ?? "—"} />
              <Stat label="Sealed intents" value={intentCount.toString()} />
            </div>
          )}
          {!isConnected && (
            <p className={styles.hint}>
              Connect a wallet on Sepolia to start.
            </p>
          )}
          {isConnected && !hasOpenEpoch && operator.isOperator && (
            <div className={styles.operatorRow}>
              <p className={styles.hint}>No epoch is open.</p>
              <Button
                variant="accent"
                size="sm"
                loading={openEpoch.isPending}
                onClick={async () => {
                  const ok = await openEpoch.openEpoch();
                  if (ok) void refetch();
                }}
              >
                Open epoch
              </Button>
            </div>
          )}
        </Card>
      </div>

      <p className={styles.privacy}>
        <Badge variant="public">Public</Badge> token pair, deadline, and that a
        batch occurred.{" "}
        <Badge variant="private">Sealed</Badge> amount, direction, limit, and
        per-user fill.
      </p>
    </div>
  );
}
