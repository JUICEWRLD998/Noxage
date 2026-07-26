"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import patterns from "@/styles/patterns.module.css";
import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "accent" | "danger";
  onConfirm: () => void;
  /** Optional trigger — controlled usage via `open` is primary. */
  children?: ReactNode;
}

/** Token-styled Radix confirmation dialog. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "accent",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children && <Dialog.Trigger asChild>{children}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${patterns.glassCard} ${patterns.edgeLight} ${styles.content}`}
        >
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description && (
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          )}
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button variant={tone} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
