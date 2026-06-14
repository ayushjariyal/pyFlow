// Fetches a single workflow, polling every `pollMs` until it reaches a terminal
// state (COMPLETED/FAILED/CANCELLED).

import { useCallback, useEffect, useRef, useState } from "react";
import { getWorkflow, toApiError, type ApiError } from "../services/api";
import type { Workflow } from "../types/workflow";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function useWorkflow(id: string | undefined, pollMs = 5000) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const first = useRef(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setWorkflow(await getWorkflow(id));
      setError(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      if (first.current) {
        setLoading(false);
        first.current = false;
      }
    }
  }, [id]);

  useEffect(() => {
    refresh();
    if (workflow && TERMINAL.has(workflow.status)) return;
    const handle = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(handle);
  }, [refresh, pollMs, workflow?.status]);

  return { workflow, loading, error, refresh };
}
