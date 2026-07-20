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
        <span className={styles.badge}>Phase 0 · Bootstrap</span>

        <section
          className={`${patterns.glassCard} ${patterns.edgeLight} ${styles.card}`}
        >
          <p className={styles.eyebrow}>Noxage</p>
          <h1 className={styles.title}>Public liquidity. Private strategy.</h1>
          <p className={styles.tagline}>
            Confidential intent settlement for open DeFi — built on iExec Nox.
          </p>
          <p className={styles.body}>
            Repo scaffold is live. Design tokens, mesh + grain surfaces, and
            motion foundations are loaded. Product logic arrives in later
            phases — no mocks, no fake privacy.
          </p>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Design system</span>
              <span className={styles.metaValue}>Noviq · OKLCH · CSS Modules</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Network target</span>
              <span className={styles.metaValue}>ETH Sepolia</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Privacy layer</span>
              <span className={styles.metaValue}>iExec Nox · TEE</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>MVP rail</span>
              <span className={styles.metaValue}>Uniswap residual (unmodified)</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        Noxage · Write The Future · iExec WTF Hackathon
      </footer>
    </div>
  );
}
