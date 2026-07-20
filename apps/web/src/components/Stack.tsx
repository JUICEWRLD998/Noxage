import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Stack.module.css";

type StackDirection = "vertical" | "horizontal";
type StackGap = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
type StackAlign = "start" | "center" | "end" | "stretch";
type StackJustify = "start" | "center" | "end" | "between" | "around";

interface StackProps extends ComponentPropsWithoutRef<"div"> {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
  children: ReactNode;
}

export function Stack({
  direction = "vertical",
  gap = "4",
  align,
  justify,
  wrap = false,
  className = "",
  children,
  ...props
}: StackProps) {
  const classes = [
    styles.stack,
    styles[direction],
    styles[`gap${gap}`],
    align ? styles[`align${align}`] : "",
    justify ? styles[`justify${justify}`] : "",
    wrap ? styles.wrap : "",
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
