import Link from "next/link";
import { buttonClassName } from "@/components";
import patterns from "@/styles/patterns.module.css";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div
        className={`${patterns.mesh} ${patterns.filmGrain}`}
        aria-hidden="true"
      />

      <main className={styles.main}>
        <span className={styles.badge}>Confidential DeFi · Sepolia</span>

        <section
          className={`${patterns.glassCard} ${patterns.edgeLight} ${styles.card}`}
        >
          <p className={styles.eyebrow}>Noxage</p>
          <h1 className={styles.title}>Public liquidity. Private strategy.</h1>
          <p className={styles.tagline}>
            Confidential intent settlement for open DeFi — built on iExec Nox.
          </p>
          <p className={styles.body}>
            Submit encrypted trade intents. A TEE runner nets opposing flow and
            settles only the residual on unmodified Uniswap. Individual sizes,
            directions, and strategies never appear in plaintext on-chain.
          </p>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Network</span>
              <span className={styles.metaValue}>ETH Sepolia</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Privacy layer</span>
              <span className={styles.metaValue}>Zama FHEVM · ERC-7984</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Settlement rail</span>
              <span className={styles.metaValue}>Uniswap v3 (unmodified)</span>
            </div>
          </div>

          <Link href="/app" className={buttonClassName("accent", "md", styles.cta)}>
            Open app →
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        Noxage · Write The Future · iExec WTF Hackathon
      </footer>
    </div>
  );
}
