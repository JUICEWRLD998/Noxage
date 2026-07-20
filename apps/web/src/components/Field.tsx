import { useId, type ComponentPropsWithoutRef } from "react";
import styles from "./Field.module.css";

interface FieldProps extends ComponentPropsWithoutRef<"input"> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
}

export function Field({
  label,
  error,
  helper,
  fullWidth = false,
  id,
  className = "",
  ...props
}: FieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const helperId = helper ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ""}`}>
      {label && (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        id={fieldId}
        className={`${styles.input} ${error ? styles.inputError : ""} ${className}`.trim()}
        aria-describedby={error ? errorId : helperId}
        aria-invalid={!!error}
        {...props}
      />
      {helper && !error && (
        <span id={helperId} className={styles.helper}>
          {helper}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// Standalone Input for composition
interface InputProps extends ComponentPropsWithoutRef<"input"> {
  error?: boolean;
}

export function Input({ error = false, className = "", ...props }: InputProps) {
  return (
    <input
      className={`${styles.input} ${error ? styles.inputError : ""} ${className}`.trim()}
      aria-invalid={error}
      {...props}
    />
  );
}
