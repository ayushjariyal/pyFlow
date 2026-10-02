// Small display helpers shared across pages.

import type { Job } from "../types/job";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 24h clock time, e.g. "16:36:30". */
export function formatTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** e.g. "02 Oct 2026, 16:36:30". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${formatTime(d)}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(2)} s`;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** Last segment of a server file path (handles both / and \ separators). */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Best-effort display name of a job's input file. */
export function jobFileName(job: Job): string {
  const meta = job.job_metadata as { original_filename?: string } | null;
  if (meta?.original_filename) return meta.original_filename;
  if (job.input_file_path) return baseName(job.input_file_path);
  return "—";
}
