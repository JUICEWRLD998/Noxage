"use client";

import { useEffect, useRef, useState } from "react";
import { useTxToast } from "@/hooks/useTxToast";
import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { truncateHex } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { Button } from "./Button";
import styles from "./WalletConnectButton.module.css";

/**
 * Connect / disconnect control for injected browser wallets (MetaMask, etc.).
 * No WalletConnect relay — fewer moving parts, more reliable local dev.
 */
export function WalletConnectButton() {
  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    connect,
    disconnect,
    switchToSepolia,
  } = useWallet();
  const toast = useTxToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (!isConnected) {
    return (
      <Button
        variant="accent"
        size="sm"
        loading={isConnecting}
        onClick={() => {
          connect().catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : "Wallet connection failed";
            toast.error("Connect failed", message);
          });
        }}
      >
        Connect wallet
      </Button>
    );
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <Button variant="secondary" size="sm" onClick={() => void switchToSepolia()}>
        Wrong network
      </Button>
    );
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setMenuOpen((open) => !open)}
        className={styles.address}
        title="Account"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <span className={styles.dot} aria-hidden="true" />
        {truncateHex(address!)}
      </Button>
      {menuOpen && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              disconnect();
              setMenuOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
