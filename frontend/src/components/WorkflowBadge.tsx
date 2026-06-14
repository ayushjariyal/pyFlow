import type { TaskStatus, WorkflowStatus } from "../types/workflow";

const STYLES: Record<WorkflowStatus | TaskStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 ring-slate-300",
  READY: "bg-blue-50 text-blue-700 ring-blue-300",
  RUNNING: "bg-blue-100 text-blue-700 ring-blue-300 animate-pulse",
  SUCCESS: "bg-green-100 text-green-700 ring-green-300",
  COMPLETED: "bg-green-100 text-green-700 ring-green-300",
  FAILED: "bg-red-100 text-red-700 ring-red-300",
  CANCELLED: "bg-amber-100 text-amber-800 ring-amber-300",
  SKIPPED: "bg-slate-100 text-slate-400 ring-slate-200",
};

export function WorkflowBadge({ status }: { status: WorkflowStatus | TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
