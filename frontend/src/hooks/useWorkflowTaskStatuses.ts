// Per-task statuses for the workflow list's progress segments. The list
// endpoint only returns a task count, so details are fetched for workflows
// whose tasks can differ from the workflow status: in-flight ones on every
// change of the list, finished-badly ones once (they no longer change).

import { useEffect, useRef, useState } from "react";
import { getWorkflow } from "../services/api";
import type { TaskStatus, WorkflowSummary } from "../types/workflow";

const MAX_FETCHES = 25;

export function useWorkflowTaskStatuses(
  workflows: WorkflowSummary[],
): Record<string, TaskStatus[]> {
  const [statuses, setStatuses] = useState<Record<string, TaskStatus[]>>({});
  // Workflow id -> the workflow status its cached task list was fetched for.
  const settled = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    const wanted = workflows
      .filter((w) => {
        if (w.status === "RUNNING") return true;
        if (w.status === "FAILED" || w.status === "CANCELLED") {
          return settled.current.get(w.id) !== w.status;
        }
        return false;
      })
      .slice(0, MAX_FETCHES);
    if (wanted.length === 0) return;

    Promise.allSettled(wanted.map((w) => getWorkflow(w.id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, TaskStatus[]> = {};
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        next[r.value.id] = r.value.tasks.map((t) => t.status);
        settled.current.set(r.value.id, r.value.status);
      });
      setStatuses((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [workflows]);

  return statuses;
}
