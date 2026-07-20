import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Container.module.css";

interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
}

export function Container({
  size = "lg",
  className = "",
  children,
  ...props
}: ContainerProps) {
  return (
    <div className={`${styles.container} ${styles[size]} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
