"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./EpochProgress.module.css";

type EpochStatus = "open" | "closed" | "settling" | "settled" | "failed";

const STAGE_INDEX: Record<EpochStatus, number> = {
  open: 0,
  closed: 1,
  settling: 2,
  settled: 3,
  failed: 3,
};

const STAGE_DESCRIPTION: Record<EpochStatus, string> = {
  open: "Epoch open, accepting sealed intents",
  closed: "Epoch closed",
  settling: "Netting in progress",
  settled: "Epoch settled",
  failed: "Epoch failed",
};

function elapsedPct(openedAt: number, closesAt: number): number {
  const duration = closesAt - openedAt;
  if (duration <= 0) return 100;
  const elapsed = Math.floor(Date.now() / 1000) - openedAt;
  return Math.min(100, Math.max(0, (elapsed / duration) * 100));
}

interface EpochProgressProps extends ComponentPropsWithoutRef<"div"> {
  status: EpochStatus;
  /** Unix seconds when the epoch opened. */
  openedAt: number;
  /** Unix seconds when the epoch closes. */
  closesAt: number;
  intentCount: number;
}

/**
 * Horizontal epoch lifecycle track: Open → Closed → Netting → Settled
 * (Failed replaces Settled in danger tone). While open, the fill reflects
 * elapsed time within the epoch window.
 */
export function EpochProgress({
  status,
  openedAt,
  closesAt,
  intentCount,
  className = "",
  ...props
}: EpochProgressProps) {
  const isOpen = status === "open";

  // Elapsed share is derived during render so it always reflects the current
  // window; the interval only forces a re-render each second while open.
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  const pct = isOpen ? elapsedPct(openedAt, closesAt) : 0;
  const stage = STAGE_INDEX[status];
  const failed = status === "failed";
  const stages = ["Open", "Closed", "Netting", failed ? "Failed" : "Settled"];

  // While open the fill tracks elapsed time within the first segment;
  // afterwards it snaps to the completed-stage boundary.
  const fillPct = isOpen ? pct * 0.25 : ((stage + 1) / stages.length) * 100;

  const progressAria = isOpen
    ? {
        role: "progressbar",
        "aria-valuenow": Math.round(pct),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-label": "Epoch time elapsed",
      }
    : {
        role: "img" as const,
        "aria-label": STAGE_DESCRIPTION[status],
      };

  return (
    <div
      className={`${styles.progress} ${failed ? styles.failed : ""} ${className}`.trim()}
      {...props}
    >
      <div className={styles.track} {...progressAria}>
        <div
          className={styles.fill}
          style={{ width: `${fillPct}%` }}
          suppressHydrationWarning
        />
      </div>
      <ol className={styles.stages}>
        {stages.map((label, i) => (
          <li
            key={label}
            className={`${styles.stage} ${i <= stage ? styles.reached : ""} ${
              i === stage ? styles.current : ""
            }`.trim()}
            aria-current={i === stage ? "step" : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
      <p className={styles.meta} data-tabular>
        {intentCount} sealed {intentCount === 1 ? "intent" : "intents"}
      </p>
    </div>
  );
}
