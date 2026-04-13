"use client";

/**
 * Global payment-confirmation toast infrastructure.
 *
 * When a server route returns a successful response with the x402 / credits
 * pricing headers (X-Claudia-Discount, X-Claudia-Tier, X-Claudia-Amount,
 * X-Claudia-Tx-Hash, X-Claudia-Original-Price), the client surfaces a
 * 4-second PaymentConfirmation toast. Cached responses (X-From-Cache: 1)
 * are suppressed — no payment happened.
 *
 * Consumers call `emitPaymentFromHeaders(res)` after every agent API fetch.
 * The provider wraps the app in Providers.tsx so any component can emit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import PaymentConfirmation from "./PaymentConfirmation";

export interface PaymentToast {
  id: number;
  amount: number;
  action: string;
  discount?: number;
  tier?: string;
  originalPrice?: number;
  txHash?: string;
}

interface PaymentToastCtx {
  showPayment: (t: Omit<PaymentToast, "id">) => void;
}

const Ctx = createContext<PaymentToastCtx | null>(null);

// Module-level bridge so non-React code (fetch helpers) can emit toasts.
// Set by the provider on mount.
let externalShow: ((t: Omit<PaymentToast, "id">) => void) | null = null;

export function PaymentToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<PaymentToast[]>([]);

  const showPayment = useCallback((t: Omit<PaymentToast, "id">) => {
    setToasts((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  // Expose to module-level bridge (single-provider assumption).
  externalShow = showPayment;

  const value = useMemo<PaymentToastCtx>(() => ({ showPayment }), [showPayment]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toasts.map((t) => (
        <PaymentConfirmation
          key={t.id}
          amount={t.amount}
          action={t.action}
          discount={t.discount}
          tier={t.tier}
          originalPrice={t.originalPrice}
          txHash={t.txHash}
          onDismiss={() => dismiss(t.id)}
        />
      ))}
    </Ctx.Provider>
  );
}

export function usePaymentToast(): PaymentToastCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Don't throw — callers often live outside the provider in tests.
    return { showPayment: () => {} };
  }
  return v;
}

/**
 * Parse response headers and emit a toast if the server indicates a payment
 * just happened. Safe to call on every successful agent fetch — it no-ops
 * when the headers are absent or when the response came from cache.
 */
export function emitPaymentFromHeaders(res: Response, action: string): void {
  if (!externalShow) return;

  // Cached responses — skip, no payment occurred
  const cached = res.headers.get("X-From-Cache");
  if (cached && cached !== "0" && cached.toLowerCase() !== "false") return;

  const tier = res.headers.get("X-Claudia-Tier") || undefined;
  const discountRaw = res.headers.get("X-Claudia-Discount");
  const amountRaw = res.headers.get("X-Claudia-Amount");
  const originalPriceRaw = res.headers.get("X-Claudia-Original-Price");
  const txHash = res.headers.get("X-Claudia-Tx-Hash") || undefined;

  // No pricing headers at all → no toast
  if (!tier && !discountRaw && !amountRaw) return;

  const discount = discountRaw != null ? Number(discountRaw) : undefined;
  const amount = amountRaw != null ? Number(amountRaw) : 0;
  const originalPrice =
    originalPriceRaw != null ? Number(originalPriceRaw) : undefined;

  externalShow({
    amount: isFinite(amount) ? amount : 0,
    action,
    discount: discount != null && isFinite(discount) ? discount : undefined,
    tier: tier ?? undefined,
    originalPrice:
      originalPrice != null && isFinite(originalPrice) ? originalPrice : undefined,
    txHash,
  });
}
