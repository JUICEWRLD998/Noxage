"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { truncateHex } from "@/lib/format";
import { Button } from "./Button";
import styles from "./WalletConnectButton.module.css";

/**
 * Connect / disconnect control backed by RainbowKit. Clicking "Connect wallet"
 * opens the RainbowKit modal listing MetaMask / Phantom / injected wallets
 * (see lib/wagmi.ts for why the list is extension-only). Nothing autoconnects:
 * the provider mounts with reconnectOnMount={false}.
 */
export function WalletConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        if (!mounted) {
          return (
            <Button variant="accent" size="sm" disabled aria-hidden="true">
              Connect wallet
            </Button>
          );
        }

        if (!connected) {
          return (
            <Button variant="accent" size="sm" onClick={openConnectModal}>
              Connect wallet
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button variant="secondary" size="sm" onClick={openChainModal}>
              Wrong network
            </Button>
          );
        }

        return (
          <Button
            variant="secondary"
            size="sm"
            onClick={openAccountModal}
            className={styles.address}
            title="Account"
          >
            <span className={styles.dot} aria-hidden="true" />
            {truncateHex(account.address)}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
