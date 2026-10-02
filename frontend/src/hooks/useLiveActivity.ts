// Counts what the workers are doing right now (running jobs + running
// workflows) for the header indicator, polling every `pollMs`.

import { useEffect, useState } from "react";
import { getWorkflowMetrics, listJobs } from "../services/api";

export interface LiveActivity {
  running: number;
  /** False once a poll fails — the API is unreachable. */
  online: boolean;
}

export function useLiveActivity(pollMs = 5000): LiveActivity {
  const [activity, setActivity] = useState<LiveActivity>({ running: 0, online: true });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [jobs, metrics] = await Promise.all([listJobs(), getWorkflowMetrics()]);
        if (cancelled) return;
        const running = jobs.filter((j) => j.status === "RUNNING").length + metrics.running;
        setActivity({ running, online: true });
      } catch {
        if (!cancelled) setActivity({ running: 0, online: false });
      }
    };
    poll();
    const id = window.setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs]);

  return activity;
}
