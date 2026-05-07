"use client";

import * as React from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

interface ToastCtx {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const Ctx = React.createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastHostProvider />");
  return ctx;
}

export function ToastHostProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { ...t, id }]);
  }, []);

  const dismiss = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      <ToastProvider swipeDirection="down">
        {children}
        {items.map((t) => (
          <Toast
            key={t.id}
            duration={t.duration ?? 4000}
            variant={t.variant}
            onOpenChange={(open) => !open && dismiss(t.id)}
          >
            <div className="grid gap-0.5">
              {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
              {t.description ? (
                <ToastDescription>{t.description}</ToastDescription>
              ) : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </Ctx.Provider>
  );
}
