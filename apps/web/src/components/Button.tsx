import { forwardRef, type ComponentPropsWithoutRef, type ForwardedRef, type ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef(
  (
    {
      variant = "accent",
      size = "md",
      loading = false,
      className = "",
      disabled,
      children,
      ...props
    }: ButtonProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span className={styles.spinner} aria-hidden="true">
            ⟳
          </span>
        )}
        <span className={loading ? styles.labelLoading : undefined}>{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";

// Helper for using button styles on links
export function buttonClassName(
  variant: ButtonVariant = "accent",
  size: ButtonSize = "md",
  extra = ""
): string {
  return `${styles.btn} ${styles[variant]} ${styles[size]} ${extra}`.trim();
}
