"use client";

import type { AccessLevel } from "@/lib/auth/access";
import type { ReactNode } from "react";

interface GateGuardProps {
  access: AccessLevel;
  requires: keyof AccessLevel;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Wrap any section that requires a specific access flag.
 * Renders fallback if the access flag is falsy, children otherwise.
 */
export function GateGuard({ access, requires, fallback, children }: GateGuardProps) {
  if (!access[requires]) return <>{fallback}</>;
  return <>{children}</>;
}
