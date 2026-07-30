import Link from "next/link";
import { buttonClassName } from "@/components/Button";
import styles from "./LandingNav.module.css";

/** Landing-only sticky nav — server component, no scroll listeners. */
export function LandingNav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Noxage
        </Link>

        <nav className={styles.links} aria-label="Landing">
          <a href="#how-it-works" className={styles.link}>
            How it works
          </a>
          <a href="#privacy" className={styles.link}>
            Privacy
          </a>
          <a href="#deployments" className={styles.link}>
            Deployments
          </a>
        </nav>

        <Link href="/app" className={buttonClassName("accent", "sm", styles.cta)}>
          Open app →
        </Link>
      </div>
    </header>
  );
}
