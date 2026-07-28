"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  NetworkBadge,
  NetworkGuardBanner,
  ThemeToggle,
  WalletConnectButton,
} from "@/components";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { TxToastBridge } from "@/hooks/useTxToast";
import { MISSING_ADDRESSES } from "@/lib/contracts";
import patterns from "@/styles/patterns.module.css";
import styles from "./app.module.css";

interface NavItem {
  href: string;
  label: string;
  phase?: string;
}

const NAV: NavItem[] = [
  { href: "/app/shield", label: "Shield" },
  { href: "/app/intent", label: "Intent" },
  { href: "/app/epoch", label: "Epoch" },
  { href: "/app/fills", label: "Fills" },
  { href: "/app/auditor", label: "Auditor" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Web3Provider>
      <MotionProvider>
        <TxToastBridge>
          <div className={styles.shell}>
            <div
              className={`${patterns.mesh} ${patterns.filmGrain}`}
              aria-hidden="true"
            />

            <header className={styles.topbar}>
              <Link href="/" className={styles.brand}>
                <span className={styles.brandMark}>◆</span> Noxage
              </Link>

              <nav className={styles.nav} aria-label="App sections">
                {NAV.map((item) => {
                  const active = pathname === item.href;
                  const disabled = !!item.phase;
                  return disabled ? (
                    <span
                      key={item.href}
                      className={`${styles.navItem} ${styles.navDisabled}`}
                      title={`${item.label} — ${item.phase}`}
                      aria-disabled="true"
                    >
                      {item.label}
                      <span className={styles.soon}>{item.phase}</span>
                    </span>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navItem} ${active ? styles.navActive : ""}`.trim()}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className={styles.actions}>
                <NetworkBadge />
                <WalletConnectButton />
                <ThemeToggle />
              </div>
            </header>

            <NetworkGuardBanner />

            {MISSING_ADDRESSES.length > 0 && (
              <p className={styles.misconfig} role="alert">
                <strong>Misconfigured build.</strong> Missing contract address
                {MISSING_ADDRESSES.length > 1 ? "es" : ""}:{" "}
                {MISSING_ADDRESSES.join(", ")}. Set the corresponding{" "}
                <code>NEXT_PUBLIC_*</code> env vars and rebuild.
              </p>
            )}

            <main className={styles.main}>{children}</main>
          </div>
        </TxToastBridge>
      </MotionProvider>
    </Web3Provider>
  );
}
