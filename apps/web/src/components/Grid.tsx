import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Grid.module.css";

type GridColumns = "1" | "2" | "3" | "4" | "auto";
type GridGap = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

interface GridProps extends ComponentPropsWithoutRef<"div"> {
  columns?: GridColumns;
  gap?: GridGap;
  children: ReactNode;
}

export function Grid({
  columns = "auto",
  gap = "4",
  className = "",
  children,
  ...props
}: GridProps) {
  return (
    <div
      className={`${styles.grid} ${styles[`cols${columns}`]} ${styles[`gap${gap}`]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
