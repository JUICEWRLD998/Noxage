import Link from "next/link";
import { buttonClassName } from "@/components/Button";
import { LandingNav } from "@/components/landing/LandingNav";
import { Storyboard } from "@/components/landing/Storyboard";
import { ETHERSCAN_ADDRESS, LANDING_DEPLOYMENTS } from "@/lib/deployments";
import { truncateHex } from "@/lib/hex";
import patterns from "@/styles/patterns.module.css";
import styles from "./page.module.css";

const PROBLEMS = [
  {
    title: "Front-running",
    body: "Pending swaps broadcast size and direction before they execute. Searchers sandwich them and take the spread — you pay it.",
  },
  {
    title: "Strategy leakage",
    body: "Every position change is public the moment it lands. Anyone can reconstruct your strategy from your address history — and copy or trade against it.",
  },
  {
    title: "Size signaling",
    body: "Large orders move markets before they finish filling. Working an order over time just gives the market longer to watch you do it.",
  },
] as const;

const PRIVATE_ITEMS = [
  "Order size and direction",
  "Limit prices and strategy",
  "Your individual fills",
  "Shielded token balances",
] as const;

const PUBLIC_ITEMS = [
  "Number of sealed intents per epoch",
  "Epoch timing and status",
  "The single net residual swap",
  "Contract addresses and code",
] as const;

const DEPLOYMENTS = LANDING_DEPLOYMENTS;

export default function Home() {
  return (
    <div className={styles.page}>
      <div
        className={`${patterns.mesh} ${patterns.filmGrain}`}
        aria-hidden="true"
      />

      <LandingNav />

      <main className={styles.main}>
        {/* --- Hero --- */}
        <section className={styles.hero}>
          <span className={styles.badge}>Confidential DeFi · ETH Sepolia</span>
          <h1 className={styles.heroTitle}>
            Public liquidity.
            <br />
            Private strategy.
          </h1>
          <p className={styles.heroTagline}>
            Noxage seals your trade intents with on-chain encryption, nets
            opposing flow inside encrypted state, and settles only the residual
            on unmodified Uniswap.
          </p>
          <div className={styles.heroCtas}>
            <Link
              href="/app"
              className={buttonClassName("accent", "lg", styles.ctaLink)}
            >
              Open app →
            </Link>
            <a
              href="#how-it-works"
              className={buttonClassName("ghost", "lg", styles.ctaLink)}
            >
              How it works
            </a>
          </div>

          <dl className={styles.heroMeta}>
            <div className={styles.heroMetaItem}>
              <dt>Network</dt>
              <dd>ETH Sepolia</dd>
            </div>
            <div className={styles.heroMetaItem}>
              <dt>Encryption</dt>
              <dd>Zama FHEVM · ERC-7984</dd>
            </div>
            <div className={styles.heroMetaItem}>
              <dt>Settlement rail</dt>
              <dd>Uniswap v3 (unmodified)</dd>
            </div>
          </dl>
        </section>

        {/* --- Problem --- */}
        <section className={styles.section}>
          <p className={styles.sectionEyebrow}>The problem</p>
          <h2 className={styles.sectionTitle}>
            Every trade you make is public.
          </h2>
          <p className={styles.sectionLede}>
            On a transparent chain, your order flow is a free data feed for
            everyone trading against you.
          </p>
          <div className={styles.problemGrid}>
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                className={`${patterns.glassCard} ${styles.problemCard}`}
              >
                <h3 className={styles.problemTitle}>{p.title}</h3>
                <p className={styles.problemBody}>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* --- How it works --- */}
        <section id="how-it-works" className={styles.section}>
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle}>
            Seal. Net. Settle the residual.
          </h2>
          <Storyboard />
        </section>

        {/* --- Privacy honesty --- */}
        <section className={styles.section}>
          <div id="privacy" className={styles.anchor} aria-hidden="true" />
          <p className={styles.sectionEyebrow}>Privacy, honestly</p>
          <h2 className={styles.sectionTitle}>
            What’s private. What’s public.
          </h2>
          <p className={styles.sectionLede}>
            Noxage doesn’t promise invisibility — it promises that the values
            that price you can’t be read. Here is the exact split.
          </p>

          <div
            className={`${patterns.glassCard} ${patterns.edgeLight} ${styles.privacySplit}`}
          >
            <div className={styles.privacyCol}>
              <h3 className={styles.privacyHeadPrivate}>Stays encrypted</h3>
              <ul className={styles.privacyList}>
                {PRIVATE_ITEMS.map((item) => (
                  <li key={item} className={styles.privacyItemPrivate}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.privacyCol}>
              <h3 className={styles.privacyHeadPublic}>Remains public</h3>
              <ul className={styles.privacyList}>
                {PUBLIC_ITEMS.map((item) => (
                  <li key={item} className={styles.privacyItemPublic}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className={styles.privacyNote}>
            Encrypted balances and intents run on Zama’s FHEVM coprocessor
            (ERC-7984). A lone intent in an epoch can be inferred from the
            residual — batching is the protection, and we say so. Full trust
            assumptions live in the{" "}
            <a
              href="https://github.com/JUICEWRLD998/Noxage/blob/main/docs/THREAT-MODEL.md"
              target="_blank"
              rel="noreferrer"
            >
              threat model
            </a>
            .
          </p>
        </section>

        {/* --- Live deployments --- */}
        <section className={styles.section}>
          <div id="deployments" className={styles.anchor} aria-hidden="true" />
          <p className={styles.sectionEyebrow}>No mocks</p>
          <h2 className={styles.sectionTitle}>Live on Sepolia.</h2>
          <p className={styles.sectionLede}>
            Every contract the app touches is deployed and verifiable. Nothing
            in the product path is simulated.
          </p>
          <div className={styles.deployments}>
            {DEPLOYMENTS.map((d) => (
              <a
                key={d.label}
                href={ETHERSCAN_ADDRESS(d.address)}
                target="_blank"
                rel="noreferrer"
                className={styles.deployment}
              >
                <span className={styles.deploymentLabel}>{d.label}</span>
                <span className={styles.deploymentAddress}>
                  {truncateHex(d.address, 8, 6)}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className={styles.finalCta}>
          <h2 className={styles.finalTitle}>
            Trade without broadcasting your strategy.
          </h2>
          <Link
            href="/app"
            className={buttonClassName("accent", "lg", styles.ctaLink)}
          >
            Open app →
          </Link>
          <p className={styles.finalHint}>
            Testnet only — grab mock tokens from the in-app faucet.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>◆ Noxage</span>
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link href="/app">App</Link>
          <Link href="/styleguide">Styleguide</Link>
          <a
            href="https://github.com/JUICEWRLD998/Noxage"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
        <span className={styles.footerNote}>
          Write The Future · iExec WTF Hackathon
        </span>
      </footer>
    </div>
  );
}
