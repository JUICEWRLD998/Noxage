"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { formatAmount } from "@/lib/format";
import styles from "./FillCard.module.css";

interface FillLegs {
  recvBase: bigint;
  recvQuote: bigint;
  payBase: bigint;
  payQuote: bigint;
}

interface FillCardProps extends ComponentPropsWithoutRef<"div"> {
  intentId: bigint;
  epochId: bigint;
  /** null while the fill is still sealed (not yet decrypted). */
  legs: FillLegs | null;
  decrypting?: boolean;
  onDecrypt?: () => void;
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}

/** One settled fill: sealed until decrypted, then shows non-zero legs only. */
export function FillCard({
  intentId,
  epochId,
  legs,
  decrypting = false,
  onDecrypt,
  baseSymbol,
  quoteSymbol,
  baseDecimals,
  quoteDecimals,
  className = "",
  ...props
}: FillCardProps) {
  const sealed = legs === null;

  const revealedRows: { label: string; value: string }[] = [];
  if (legs) {
    if (legs.recvBase > 0n)
      revealedRows.push({
        label: "Received",
        value: `${formatAmount(legs.recvBase, baseDecimals)} ${baseSymbol}`,
      });
    if (legs.recvQuote > 0n)
      revealedRows.push({
        label: "Received",
        value: `${formatAmount(legs.recvQuote, quoteDecimals)} ${quoteSymbol}`,
      });
    if (legs.payBase > 0n)
      revealedRows.push({
        label: "Paid",
        value: `${formatAmount(legs.payBase, baseDecimals)} ${baseSymbol}`,
      });
    if (legs.payQuote > 0n)
      revealedRows.push({
        label: "Paid",
        value: `${formatAmount(legs.payQuote, quoteDecimals)} ${quoteSymbol}`,
      });
  }

  return (
    <div
      className={`${styles.card} ${sealed ? styles.sealedTone : styles.settledTone} ${className}`.trim()}
      {...props}
    >
      <div className={styles.header}>
        {sealed ? (
          <Badge variant="private">Sealed</Badge>
        ) : (
          <Badge variant="success">Settled</Badge>
        )}
      </div>

      {sealed ? (
        <>
          <div className={styles.rows}>
            <Row label="Received" value={<Dots />} />
            <Row label="Received" value={<Dots />} />
            <Row label="Paid" value={<Dots />} />
            <Row label="Paid" value={<Dots />} />
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={decrypting}
            onClick={onDecrypt}
          >
            Decrypt fill
          </Button>
        </>
      ) : (
        <div className={styles.rows}>
          {revealedRows.length === 0 ? (
            <p className={styles.residual}>No residual — fully netted.</p>
          ) : (
            revealedRows.map((row, i) => (
              <Row key={i} label={row.label} value={row.value} />
            ))
          )}
        </div>
      )}

      <div className={styles.meta}>
        <span>Epoch #{epochId.toString()}</span>
        <span>Intent #{intentId.toString()}</span>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className={styles.sealedValue} title="Encrypted — only you can decrypt">
      ●●●●
    </span>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}
