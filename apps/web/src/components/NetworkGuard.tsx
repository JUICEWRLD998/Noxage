"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { useAccount, useSwitchChain } from "@/lib/wallet";
import { Button } from "./Button";
import styles from "./NetworkGuard.module.css";

/** Small badge showing the active network state. */
export function NetworkBadge() {
  const { isConnected, chainId } = useAccount();
  if (!isConnected) return null;
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;
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
 * Hard gate shown when connected to the wrong chain. Noxage runs on Sepolia
 * only, so we render a blocking, mandatory overlay (plus the banner) rather
 * than silently misbehave. Escape is intentionally a no-op — the only way
 * out is switching networks (or disconnecting via the wallet itself).
 */
export function NetworkGuardBanner() {
  const { isConnected, chainId, chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  const dialogRef = useRef<HTMLDivElement>(null);
  const blocked = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  useEffect(() => {
    if (!blocked) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [blocked]);

  if (!blocked) return null;

  const wrongChainName = chain?.name ?? `an unsupported network (id ${chainId})`;

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled])",
    );
    if (!focusables || focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className={styles.banner} role="alert">
        <div className={styles.bannerText}>
          <strong>Wrong network.</strong> Noxage runs on Ethereum Sepolia.
          Switch to continue.
        </div>
        <Button
          variant="accent"
          size="sm"
          loading={isPending}
          onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
        >
          Switch to Sepolia
        </Button>
      </div>

      <div className={styles.overlay}>
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="network-guard-title"
          aria-describedby="network-guard-desc"
          tabIndex={-1}
          onKeyDown={trapFocus}
        >
          <h2 id="network-guard-title" className={styles.dialogTitle}>
            Wrong network
          </h2>
          <p id="network-guard-desc" className={styles.dialogText}>
            Noxage runs exclusively on Ethereum Sepolia — switch networks to
            continue.
          </p>
          <Button
            variant="accent"
            size="lg"
            loading={isPending}
            onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
          >
            Switch to Sepolia
          </Button>
          <p className={styles.dialogChain}>
            Connected to <strong>{wrongChainName}</strong>
          </p>
        </div>
      </div>
    </>
  );
}
