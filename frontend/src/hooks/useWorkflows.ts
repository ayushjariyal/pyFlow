// Lists workflows + metrics, polling every `pollMs` (default 5s).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWorkflowMetrics,
  listWorkflows,
  toApiError,
  type ApiError,
} from "../services/api";
import type { WorkflowMetrics, WorkflowSummary } from "../types/workflow";

export function useWorkflows(pollMs = 5000) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const first = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [wf, m] = await Promise.all([listWorkflows(), getWorkflowMetrics()]);
      setWorkflows(wf);
      setMetrics(m);
      setError(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      if (first.current) {
        setLoading(false);
        first.current = false;
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { workflows, metrics, loading, error, refresh };
}
