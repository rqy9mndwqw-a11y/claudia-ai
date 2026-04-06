"use client";

import { useEffect } from "react";

/**
 * Calls sdk.actions.ready() on mount to dismiss the Farcaster splash screen.
 * Placed in root layout so it fires on every page, not just /roast.
 */
export default function MiniAppReady() {
  useEffect(() => {
    import("@farcaster/miniapp-sdk")
      .then(({ default: sdk }) => {
        sdk.actions.ready();
      })
      .catch(() => {
        // Not in Farcaster — ignore
      });
  }, []);

  return null;
}
