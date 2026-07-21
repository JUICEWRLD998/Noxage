import type { ReactNode } from "react";
import styles from "./StateBlock.module.css";

interface StateBlockProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}

/** Reusable empty / error surface for async states. */
export function StateBlock({
  title,
  description,
  icon,
  action,
  tone = "neutral",
}: StateBlockProps) {
  return (
    <div className={`${styles.block} ${tone === "error" ? styles.error : ""}`.trim()}>
      {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function EmptyState(props: Omit<StateBlockProps, "tone">) {
  return <StateBlock {...props} tone="neutral" />;
}

export function ErrorState(props: Omit<StateBlockProps, "tone">) {
  return <StateBlock {...props} tone="error" />;
}
