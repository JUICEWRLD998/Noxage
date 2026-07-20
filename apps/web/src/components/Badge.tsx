import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "private" | "public";

interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
