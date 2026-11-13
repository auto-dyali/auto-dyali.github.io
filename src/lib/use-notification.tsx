"use client";

/**
 * AUTO DYALI — Hook de notification unifié.
 * Fournit des fonctions simples pour afficher des bulles (toasts)
 * de succès, erreur, avertissement et information.
 */

import { useCallback } from "react";
import { useToast, type ToastType } from "@/components/toast";

type NotifyOptions = {
  title: string;
  message?: string;
  duration?: number;
};

export function useNotification() {
  const { addToast } = useToast();

  const notify = useCallback(
    (type: ToastType, { title, message, duration = 5000 }: NotifyOptions) => {
      addToast({ type, title, message, duration });
    },
    [addToast],
  );

  const success = useCallback(
    (opts: NotifyOptions) => notify("success", opts),
    [notify],
  );

  const error = useCallback(
    (opts: NotifyOptions) => notify("error", opts),
    [notify],
  );

  const warning = useCallback(
    (opts: NotifyOptions) => notify("warning", opts),
    [notify],
  );

  const info = useCallback(
    (opts: NotifyOptions) => notify("info", opts),
    [notify],
  );

  return { success, error, warning, info, addToast };
}
