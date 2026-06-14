// Small display helpers shared across pages.

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(2)} s`;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

import type { Job } from "../types/job";

/** Best-effort display name of a job's input file. */
export function jobFileName(job: Job): string {
  const meta = job.job_metadata as { original_filename?: string } | null;
  if (meta?.original_filename) return meta.original_filename;
  if (job.input_file_path) return job.input_file_path.split("/").pop() ?? "—";
  return "—";
}
