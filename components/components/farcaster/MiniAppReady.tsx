"use client";

import { useEffect } from "react";

/**
 * Calls sdk.actions.ready() on mount to dismiss the Farcaster splash screen.
 * Must fire ASAP — no dynamic import() delay.
 */
export default function MiniAppReady() {
  useEffect(() => {
    // Top-level eager import — the SDK is tree-shaken in non-Farcaster builds
    import("@farcaster/miniapp-sdk").then((mod) => {
      // mod.default is the sdk instance (ESM default export)
      const sdk = mod.default ?? mod;
      if (sdk?.actions?.ready) {
        sdk.actions.ready();
      }
    }).catch(() => {
      // Not in Farcaster context — safe to ignore
    });
  }, []);

  return null;
}
