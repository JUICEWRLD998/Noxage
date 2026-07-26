"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Badge } from "./Badge";
import { formatCountdown } from "@/lib/format";
import styles from "./EpochClock.module.css";

type EpochStatus = "open" | "closed" | "settling" | "settled" | "failed";

const STATUS_LABEL: Record<EpochStatus, string> = {
  open: "Open",
  closed: "Closed",
  settling: "Settling",
  settled: "Settled",
  failed: "Failed",
};

const STATUS_VARIANT: Record<
  EpochStatus,
  "accent" | "default" | "warning" | "success" | "danger"
> = {
  open: "accent",
  closed: "default",
  settling: "warning",
  settled: "success",
  failed: "danger",
};

function secondsLeft(closesAt: number): number {
  return Math.max(0, closesAt - Math.floor(Date.now() / 1000));
}

interface EpochClockProps extends ComponentPropsWithoutRef<"div"> {
  /** Unix seconds when the open epoch closes. */
  closesAt: number;
  status: EpochStatus;
  epochId?: bigint | number;
}

/** Countdown display for an open epoch. Ticks every second while open. */
export function EpochClock({
  closesAt,
  status,
  epochId,
  className = "",
  ...props
}: EpochClockProps) {
  // The countdown is derived during render so it always reflects the current
  // `closesAt`; the interval only forces a re-render each second while open.
  const [, tick] = useState(0);

  useEffect(() => {
    if (status !== "open") return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const remaining = secondsLeft(closesAt);
  const isOpen = status === "open";
  const closing = isOpen && remaining <= 0;

  return (
    <div className={`${styles.clock} ${className}`.trim()} {...props}>
      <div className={styles.top}>
        <span className={styles.label}>
          {epochId !== undefined ? `Epoch #${epochId.toString()}` : "Epoch"}
        </span>
        <Badge variant={STATUS_VARIANT[status]}>
          {isOpen && <span className={styles.dot} aria-hidden="true" />}
          {STATUS_LABEL[status]}
        </Badge>
      </div>
      <div className={styles.time} suppressHydrationWarning>
        {formatCountdown(isOpen ? remaining : 0)}
      </div>
      {closing && <p className={styles.hint}>closing…</p>}
    </div>
  );
}
