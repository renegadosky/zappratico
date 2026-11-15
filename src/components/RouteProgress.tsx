import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Slim top progress bar that animates while the router is loading
 * the next route. Gives a professional "something is happening" cue.
 */
export function RouteProgress() {
  const status = useRouterState({ select: (s) => s.status });
  const isLoading = status === "pending";
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf: number | null = null;
    let timeout: number | null = null;

    if (isLoading) {
      setVisible(true);
      setProgress(8);
      const tick = () => {
        setProgress((p) => (p < 85 ? p + (90 - p) * 0.06 : p));
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    } else {
      setProgress(100);
      timeout = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[100] h-[2px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-primary-glow to-primary shadow-[0_0_10px_oklch(0.78_0.18_152/0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
