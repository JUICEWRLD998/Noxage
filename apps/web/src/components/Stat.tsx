import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Stat.module.css";

interface StatProps extends ComponentPropsWithoutRef<"div"> {
  label: string;
  value: ReactNode;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export function Stat({
  label,
  value,
  change,
  changeType = "neutral",
  className = "",
  ...props
}: StatProps) {
  return (
    <div className={`${styles.stat} ${className}`.trim()} {...props}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} data-tabular>
        {value}
      </div>
      {change && (
        <div className={`${styles.change} ${styles[changeType]}`}>{change}</div>
      )}
    </div>
  );
}
