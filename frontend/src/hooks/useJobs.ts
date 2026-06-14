// Fetches the job list and re-polls every `pollMs` (default 5s).

import { useCallback, useEffect, useRef, useState } from "react";
import { listJobs, toApiError, type ApiError } from "../services/api";
import type { Job } from "../types/job";

export function useJobs(pollMs = 5000) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Avoid showing the full-page spinner on background refreshes.
  const isFirstLoad = useRef(true);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await listJobs();
      setJobs(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(toApiError(err));
    } finally {
      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const id = window.setInterval(fetchJobs, pollMs);
    return () => window.clearInterval(id);
  }, [fetchJobs, pollMs]);

  return { jobs, loading, error, lastUpdated, refresh: fetchJobs };
}
