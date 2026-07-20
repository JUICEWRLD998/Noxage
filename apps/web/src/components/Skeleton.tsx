import type { ComponentPropsWithoutRef } from "react";
import styles from "./Skeleton.module.css";

type SkeletonVariant = "text" | "circular" | "rectangular";

interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const inlineStyle = {
    ...style,
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className}`.trim()}
      style={inlineStyle}
      aria-hidden="true"
      {...props}
    />
  );
}
