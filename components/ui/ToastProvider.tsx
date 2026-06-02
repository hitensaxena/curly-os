"use client";

// App-wide toast stack. Mounted once in the root layout (inside VoiceProvider).
// useToast() gives any client component success/error/info nudges. Renders via a
// portal to document.body so toasts float above the command bar, panel, and orb.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toast, type ToastVariant } from "./Toast";

type ToastItem = { id: number; variant: ToastVariant; message: ReactNode };

type ToastApi = {
  show: (message: ReactNode, opts?: { variant?: ToastVariant; ttl?: number }) => number;
  success: (message: ReactNode) => number;
  error: (message: ReactNode) => number;
  info: (message: ReactNode) => number;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setMounted(true);
    const t = timers.current;
    return () => {
      for (const id of t.values()) clearTimeout(id);
      t.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, opts) => {
      const id = idRef.current++;
      const ttl = opts?.ttl ?? 4000;
      setItems((xs) => [...xs, { id, variant: opts?.variant ?? "info", message }]);
      if (ttl > 0) timers.current.set(id, setTimeout(() => dismiss(id), ttl));
      return id;
    },
    [dismiss],
  );

  const success = useCallback((m: ReactNode) => show(m, { variant: "success" }), [show]);
  const error = useCallback((m: ReactNode) => show(m, { variant: "danger", ttl: 6000 }), [show]);
  const info = useCallback((m: ReactNode) => show(m, { variant: "info" }), [show]);

  const api: ToastApi = { show, success, error, info, dismiss };

  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
            {items.map((it) => (
              <Toast
                key={it.id}
                variant={it.variant}
                className="pointer-events-auto w-full max-w-sm cursor-pointer shadow-lg backdrop-blur-md motion-safe:animate-[cardin_0.25s_var(--ease-out)]"
              >
                <button
                  type="button"
                  onClick={() => dismiss(it.id)}
                  aria-label="Dismiss"
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="flex-1">{it.message}</span>
                  <span aria-hidden className="mt-px text-muted">
                    ×
                  </span>
                </button>
              </Toast>
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used within <ToastProvider>");
  return c;
}
