import styles from "./Storyboard.module.css";

/**
 * "How it works" in three beats — Seal, Net, Settle.
 * Static stacked layout (no scroll pinning / GSAP) for fast load and smooth scroll.
 */

const BEATS = [
  {
    id: "seal",
    step: "01",
    title: "Seal",
    body: "Choose pair, side, and size — then encrypt. Your intent lands on-chain as ciphertext. Size, direction, and limit never appear in plaintext.",
  },
  {
    id: "net",
    step: "02",
    title: "Net",
    body: "Each epoch, opposing sealed intents cancel against each other inside encrypted state. Matched flow settles internally — it never touches a public pool.",
  },
  {
    id: "settle",
    step: "03",
    title: "Settle",
    body: "Only the net residual — one aggregate amount — exits to Uniswap on a public transaction. Your fill stays encrypted; you decrypt it privately.",
  },
] as const;

export function Storyboard() {
  return (
    <div className={styles.stage}>
      {BEATS.map((beat) => (
        <article key={beat.id} className={styles.beat} data-beat={beat.id}>
          <div className={styles.beatText}>
            <span className={styles.step}>{beat.step}</span>
            <h3 className={styles.beatTitle}>{beat.title}</h3>
            <p className={styles.beatBody}>{beat.body}</p>
          </div>

          <div className={styles.beatVisual} aria-hidden="true">
            {beat.id === "seal" && <SealVisual />}
            {beat.id === "net" && <NetVisual />}
            {beat.id === "settle" && <SettleVisual />}
          </div>
        </article>
      ))}
    </div>
  );
}

function SealVisual() {
  return (
    <div className={styles.sealCard}>
      <div className={styles.sealRow}>
        <span className={styles.sealLabel}>Pair</span>
        <span className={styles.sealValue}>mWETH / mUSDC</span>
      </div>
      <div className={styles.sealRow}>
        <span className={styles.sealLabel}>Side</span>
        <span className={styles.sealSealed}>●●●●</span>
      </div>
      <div className={styles.sealRow}>
        <span className={styles.sealLabel}>Amount</span>
        <span className={styles.sealSealed}>●●●●●●</span>
      </div>
      <div className={styles.sealRow}>
        <span className={styles.sealLabel}>Limit</span>
        <span className={styles.sealSealed}>●●●●</span>
      </div>
      <span className={styles.sealBadge}>Sealed on-chain</span>
    </div>
  );
}

function NetVisual() {
  return (
    <div className={styles.netFrame}>
      <span className={styles.netLabel}>Encrypted state</span>
      <div className={styles.netFlows}>
        <span className={`${styles.netFlow} ${styles.netBuy}`}>buy ●●●●</span>
        <span className={styles.netCancel}>⇄</span>
        <span className={`${styles.netFlow} ${styles.netSell}`}>sell ●●●●</span>
      </div>
      <p className={styles.netCaption}>
        Matched flow cancels here — nothing reaches a public pool.
      </p>
    </div>
  );
}

function SettleVisual() {
  return (
    <div className={styles.settleSplit}>
      <div className={styles.settlePrivate}>
        <span className={styles.settleTag}>Your fill</span>
        <span className={styles.sealSealed}>●●●●●●</span>
        <span className={styles.settleHint}>encrypted, decrypt anytime</span>
      </div>
      <div className={styles.settlePublic}>
        <span className={styles.settleTag}>Public residual</span>
        <span className={styles.settleHash}>0x9f2c…residual</span>
        <span className={styles.settleHint}>one aggregate swap on Uniswap</span>
      </div>
    </div>
  );
}
