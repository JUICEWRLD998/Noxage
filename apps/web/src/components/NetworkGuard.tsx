"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Button } from "./Button";
import styles from "./NetworkGuard.module.css";

/** Small badge showing the active network state. */
export function NetworkBadge() {
  const { isConnected, chainId } = useAccount();
  if (!isConnected) return null;
  const onSepolia = chainId === sepolia.id;
  return (
    <span
      className={`${styles.badge} ${onSepolia ? styles.ok : styles.wrong}`}
      title={onSepolia ? "Ethereum Sepolia" : "Wrong network"}
    >
      <span className={styles.dot} aria-hidden="true" />
      {onSepolia ? "Sepolia" : "Wrong network"}
    </span>
  );
}

/**
 * Blocking banner shown when connected to the wrong chain. Noxage runs on
 * Sepolia only, so we hard-gate rather than silently misbehave.
 */
export function NetworkGuardBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.bannerText}>
        <strong>Wrong network.</strong> Noxage runs on Ethereum Sepolia. Switch
        to continue.
      </div>
      <Button
        variant="accent"
        size="sm"
        loading={isPending}
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        Switch to Sepolia
      </Button>
    </div>
  );
}
