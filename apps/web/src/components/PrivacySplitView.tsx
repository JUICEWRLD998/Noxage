import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Badge } from "./Badge";
import { Card } from "./Card";
import styles from "./PrivacySplitView.module.css";

interface PrivacySplitViewProps extends ComponentPropsWithoutRef<"div"> {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * Two-column hero surface: private (glass, sealed glow) vs public (plain).
 * Stacks on narrow viewports.
 */
export function PrivacySplitView({
  left,
  right,
  leftLabel = "Private",
  rightLabel = "Public",
  className = "",
  ...props
}: PrivacySplitViewProps) {
  return (
    <div className={`${styles.split} ${className}`.trim()} {...props}>
      <Card glass edgeLight className={styles.privateCol}>
        <Badge variant="private">{leftLabel}</Badge>
        <div className={styles.body}>{left}</div>
      </Card>
      <span className={styles.divider} aria-hidden="true">
        vs
      </span>
      <Card className={styles.publicCol}>
        <Badge variant="public">{rightLabel}</Badge>
        <div className={styles.body}>{right}</div>
      </Card>
    </div>
  );
}
