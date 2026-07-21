import { ETHERSCAN_TX } from "@/lib/contracts";
import { truncateHex } from "@/lib/format";
import styles from "./TxHashLink.module.css";

interface TxHashLinkProps {
  hash: string;
  label?: string;
}

/** Etherscan (Sepolia) link for a tx hash, rendered in mono + truncated. */
export function TxHashLink({ hash, label }: TxHashLinkProps) {
  return (
    <a
      className={styles.link}
      href={ETHERSCAN_TX(hash)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.hash}>{truncateHex(hash)}</span>
      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
