"use client";

import { useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps extends ComponentPropsWithoutRef<"code"> {
  code: string;
  truncate?: boolean;
  copyable?: boolean;
}

export function CodeBlock({
  code,
  truncate = false,
  copyable = true,
  className = "",
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={styles.wrapper}>
      <code
        className={`${styles.code} ${truncate ? styles.truncate : ""} ${className}`.trim()}
        data-tabular
        {...props}
      >
        {code}
      </code>
      {copyable && (
        <button
          className={styles.copy}
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy to clipboard"}
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? "✓" : "⧉"}
        </button>
      )}
    </div>
  );
}
