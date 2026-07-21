"use client";

import { motion } from "framer-motion";
import { Badge } from "./Badge";
import { TxHashLink } from "./TxHashLink";
import styles from "./SealedIntentCard.module.css";
import type { SealedIntent } from "@/hooks/useSubmitIntent";
import { MVP_PAIR_LABEL } from "@/lib/contracts";

interface SealedIntentCardProps {
  intent: SealedIntent;
}

const SIDE_LABEL: Record<number, string> = { 0: "Sell", 1: "Buy" };

/**
 * Shown after a successful submitIntent. Displays only the public fields
 * (pair, side, deadline, epoch, intent id) — amount is sealed and never shown.
 */
export function SealedIntentCard({ intent }: SealedIntentCardProps) {
  const deadline = new Date(Number(intent.deadline) * 1000).toLocaleString();

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.header}>
        <Badge variant="private">Sealed</Badge>
        <span className={styles.intentId}>
          Intent #{intent.intentId.toString()}
        </span>
      </div>

      <div className={styles.rows}>
        <Row label="Pair" value={MVP_PAIR_LABEL} />
        <Row label="Side" value={SIDE_LABEL[intent.side] ?? "—"} />
        <Row label="Epoch" value={`#${intent.epochId.toString()}`} mono />
        <Row label="Deadline" value={deadline} />
        <Row
          label="Amount"
          value={
            <span className={styles.sealed} title="Encrypted — only you can decrypt">
              ●●●● sealed
            </span>
          }
        />
      </div>

      <div className={styles.footer}>
        <TxHashLink hash={intent.txHash} label="Tx" />
      </div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={`${styles.rowValue} ${mono ? styles.mono : ""}`.trim()}>
        {value}
      </span>
    </div>
  );
}
