// Fetches a single job and polls every `pollMs` until it reaches a terminal
// state (SUCCESS/FAILED), at which point polling stops automatically.

import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, toApiError, type ApiError } from "../services/api";
import type { Job } from "../types/job";

const TERMINAL = new Set(["SUCCESS", "FAILED"]);

export function useJob(id: string | undefined, pollMs = 5000) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const isFirstLoad = useRef(true);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getJob(id);
      setJob(data);
      setError(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
    // Stop polling once the job is finished — no point hammering the API.
    if (job && TERMINAL.has(job.status)) return;
    const handle = window.setInterval(fetchJob, pollMs);
    return () => window.clearInterval(handle);
  }, [fetchJob, pollMs, job?.status]);

  return { job, loading, error, refresh: fetchJob };
}
