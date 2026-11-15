import { ReactNode } from "react";

/**
 * Lightweight wrapper. We intentionally do NOT key by pathname anymore —
 * remounting the entire page on every navigation caused a perceptible
 * blur/lag. The router already swaps content; a subtle CSS fade is enough.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
