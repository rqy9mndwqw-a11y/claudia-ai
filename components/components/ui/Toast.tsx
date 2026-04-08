"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: "border-green-500/30 bg-green-500/10 text-green-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-accent/30 bg-accent/10 text-accent",
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container — bottom-right, above FloatingClaudia */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-black/20
                         backdrop-blur-md animate-fade-in ${TYPE_STYLES[t.type]}`}
              role="alert"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{t.message}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
