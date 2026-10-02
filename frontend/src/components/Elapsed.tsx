import { useEffect, useState } from "react";

/** Live "3.4s" counter measured from an ISO timestamp. */
export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return null;
  return <>{(Math.max(0, now - start) / 1000).toFixed(1)}s</>;
}
