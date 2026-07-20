import type { ComponentPropsWithoutRef, ReactNode } from "react";
import patterns from "@/styles/patterns.module.css";
import styles from "./Card.module.css";

interface CardProps extends ComponentPropsWithoutRef<"div"> {
  glass?: boolean;
  edgeLight?: boolean;
  children: ReactNode;
}

export function Card({
  glass = false,
  edgeLight = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const classes = [
    glass ? patterns.glassCard : styles.card,
    edgeLight ? patterns.edgeLight : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
