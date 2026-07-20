"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import type { ReactNode } from "react";
import styles from "./Toast.module.css";

type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Toast({
  title,
  description,
  variant = "info",
  duration = 5000,
  open,
  onOpenChange,
}: ToastProps) {
  return (
    <ToastPrimitive.Root
      className={`${styles.root} ${styles[variant]}`}
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
    >
      <ToastPrimitive.Title className={styles.title}>{title}</ToastPrimitive.Title>
      {description && (
        <ToastPrimitive.Description className={styles.description}>
          {description}
        </ToastPrimitive.Description>
      )}
      <ToastPrimitive.Close className={styles.close} aria-label="Close">
        ×
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport className={styles.viewport} />
    </ToastPrimitive.Provider>
  );
}
