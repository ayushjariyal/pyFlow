// Eased 0 → 1 ramp that runs once on mount; multiply a value by it to count up.

import { useEffect, useState } from "react";

export function useCountUp(durationMs = 1100): number {
  const [k, setK] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setK(1);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setK(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [durationMs]);

  return k;
}
