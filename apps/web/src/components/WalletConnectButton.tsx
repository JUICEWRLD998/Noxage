"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { truncateHex } from "@/lib/format";
import { Button } from "./Button";
import styles from "./WalletConnectButton.module.css";

/** Connect / disconnect control. Lists available connectors (injected + WC). */
export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => disconnect()}
        className={styles.address}
        title="Disconnect"
      >
        <span className={styles.dot} aria-hidden="true" />
        {truncateHex(address)}
      </Button>
    );
  }

  const readyConnectors = connectors.filter((c) => c.type !== "mock");

  return (
    <div className={styles.wrapper}>
      <Button
        variant="accent"
        size="sm"
        loading={isPending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Connect wallet
      </Button>
      {open && (
        <div className={styles.menu} role="menu">
          {readyConnectors.map((connector) => (
            <button
              key={connector.uid}
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
