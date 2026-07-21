"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Toast } from "@/components/Toast";

type Variant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: Variant;
}

interface ToastApi {
  notify: (title: string, opts?: { description?: string; variant?: Variant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Bridges hooks to the Radix Toast viewport already mounted by ToastProvider.
 * Mount <TxToastBridge> inside the app tree; call useTxToast() anywhere below.
 */
export function TxToastBridge({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback<ToastApi["notify"]>((title, opts) => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        title,
        description: opts?.description,
        variant: opts?.variant ?? "info",
      },
    ]);
  }, []);

  const api: ToastApi = {
    notify,
    success: (title, description) => notify(title, { description, variant: "success" }),
    error: (title, description) => notify(title, { description, variant: "error" }),
    info: (title, description) => notify(title, { description, variant: "info" }),
  };

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={api}>
      {children}
      {items.map((t) => (
        <Toast
          key={t.id}
          title={t.title}
          description={t.description}
          variant={t.variant}
          open
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        />
      ))}
    </ToastContext.Provider>
  );
}

export function useTxToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useTxToast must be used within TxToastBridge");
  }
  return ctx;
}
