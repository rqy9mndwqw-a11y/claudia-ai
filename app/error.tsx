"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log server-side digest + message so CF logs retain context
    // eslint-disable-next-line no-console
    console.error("[app/error.tsx]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div
        aria-hidden="true"
        className="text-6xl md:text-8xl font-bold mb-6 select-none"
        style={{
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--color-red)",
          letterSpacing: "0.15em",
          textShadow:
            "2px 0 0 color-mix(in srgb, var(--color-red) 60%, transparent), -2px 0 0 color-mix(in srgb, var(--base-blue) 60%, transparent)",
        }}
      >
        5¿¿
      </div>

      <h1
        className="text-2xl md:text-3xl font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Something broke on CLAUDIA&apos;s end
      </h1>

      <p
        className="text-sm md:text-base mb-6 max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        The server choked on that request. We logged it — but you can try again,
        or head somewhere working.
      </p>

      {error.digest && (
        <div
          className="mb-8 text-xs font-mono px-3 py-1 rounded"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          digest: {error.digest}
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, var(--color-green) 15%, transparent)",
            color: "var(--color-green)",
            border: "1px solid color-mix(in srgb, var(--color-green) 35%, transparent)",
          }}
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, var(--base-blue) 15%, transparent)",
            color: "var(--base-blue)",
            border: "1px solid color-mix(in srgb, var(--base-blue) 35%, transparent)",
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
