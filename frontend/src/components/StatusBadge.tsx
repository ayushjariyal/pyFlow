import type { JobStatus } from "../types/job";

const STYLES: Record<JobStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 ring-slate-300",
  RUNNING: "bg-blue-100 text-blue-700 ring-blue-300 animate-pulse",
  SUCCESS: "bg-green-100 text-green-700 ring-green-300",
  FAILED: "bg-red-100 text-red-700 ring-red-300",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
