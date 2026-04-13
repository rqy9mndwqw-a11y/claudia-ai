import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Glitched CLAUDIA face */}
      <div
        aria-hidden="true"
        className="text-6xl md:text-8xl font-bold mb-6 select-none"
        style={{
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--color-green)",
          letterSpacing: "0.15em",
          textShadow:
            "2px 0 0 color-mix(in srgb, var(--base-blue) 70%, transparent), -2px 0 0 color-mix(in srgb, var(--color-green) 70%, transparent)",
        }}
      >
        4¿4
      </div>

      <h1
        className="text-2xl md:text-3xl font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        This page doesn&apos;t exist yet
      </h1>

      <p
        className="text-sm md:text-base mb-8 max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        CLAUDIA looked everywhere. Either the link is broken, or the feature
        hasn&apos;t shipped yet. Both are possible.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, var(--color-green) 15%, transparent)",
            color: "var(--color-green)",
            border: "1px solid color-mix(in srgb, var(--color-green) 35%, transparent)",
          }}
        >
          Go to Dashboard
        </Link>
        <Link
          href="/arena"
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, var(--base-blue) 15%, transparent)",
            color: "var(--base-blue)",
            border: "1px solid color-mix(in srgb, var(--base-blue) 35%, transparent)",
          }}
        >
          Go to Arena
        </Link>
      </div>

      <div
        className="mt-10 text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        error_code: 404_ROUTE_UNKNOWN
      </div>
    </div>
  );
}
