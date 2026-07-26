"use client";

import { motion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";
import { durationsSec, easings } from "@/lib/motion";
import styles from "./WakeMeter.module.css";

interface WakeMeterProps extends ComponentPropsWithoutRef<"div"> {
  /** 0–100, or null when the fill has not been decrypted yet. */
  nettedPct: number | null;
  caption?: string;
}

/** "% of your flow netted privately" meter. */
export function WakeMeter({
  nettedPct,
  caption = "of your flow netted privately",
  className = "",
  ...props
}: WakeMeterProps) {
  if (nettedPct === null) {
    return (
      <div className={`${styles.meter} ${className}`.trim()} {...props}>
        <div className={styles.valueRow}>
          <span className={styles.sealedValue}>●●●●</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fillIdle} />
        </div>
        <p className={styles.caption}>Decrypt your fill to reveal</p>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, nettedPct));

  return (
    <div className={`${styles.meter} ${className}`.trim()} {...props}>
      <div className={styles.valueRow}>
        <span className={styles.value}>{pct.toFixed(0)}%</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={caption}
      >
        <motion.div
          className={styles.fill}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: durationsSec[4], ease: easings.outExpo }}
        />
      </div>
      <p className={styles.caption}>{caption}</p>
    </div>
  );
}
