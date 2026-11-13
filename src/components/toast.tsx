"use client";

/**
 * AUTO DYALI — Système de notifications visibles (toasts/snackbars).
 * Affiche des bulles au premier plan, au-dessus de l'interface,
 * avec un état visuel distinct pour succès, erreur, avertissement et information.
 */

import { createContext, useCallback, useContext, useState, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

const TYPE_STYLE: Record<ToastType, { bg: string; text: string; border: string; icon: string }> = {
  success: { bg: "bg-[#5D9E7F]/15", text: "text-[#5D9E7F]", border: "border-[#5D9E7F]/30", icon: "✓" },
  error:   { bg: "bg-[#C5716B]/15", text: "text-[#C5716B]", border: "border-[#C5716B]/30", icon: "✕" },
  warning: { bg: "bg-[#D6A34D]/15", text: "text-[#D6A34D]", border: "border-[#D6A34D]/30", icon: "⚠" },
  info:    { bg: "bg-[#8FB59B]/15", text: "text-[#8FB59B]", border: "border-[#8FB59B]/30", icon: "ℹ" },
};

const ToastContext = createContext<{ addToast: (t: Omit<Toast, "id">) => string; removeToast: (id: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    toasts.forEach((t) => {
      if (t.duration && t.duration > 0) {
        const timer = setTimeout(() => removeToast(t.id), t.duration);
        timers.push(timer);
      }
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      <div className="relative">
        {children}
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => {
            const style = TYPE_STYLE[t.type];
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-[#8FB59B]/30 px-4 py-3 min-w-[300px] max-w-[450px] shadow-lg shadow-[#000]/40 backdrop-blur-sm transition-all duration-300 ${style.bg} ${style.border}`}
              >
                <div className="shrink-0 mt-0.5 text-[#E8ECE8] font-bold">{style.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className={`${style.text} font-bold text-sm leading-tight`}>{t.title}</div>
                  {t.message && (
                    <div className="text-[#A7B7A8] text-xs mt-0.5 leading-tight">{t.message}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="ml-2 shrink-0 rounded bg-[#344440]/30 px-1.5 py-1 text-xs text-[#A7B7A8] hover:text-[#E8ECE8]"
                  aria-label="Fermer la notification"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider");
  }
  return ctx;
}
