import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useJobs } from "../hooks/useJobs";
import { JOB_STATUSES, JOB_TYPE_LABELS, type JobStatus } from "../types/job";
import {
  formatDateTime,
  formatDuration,
  jobFileName,
  shortId,
} from "../utils/format";

type StatusFilter = JobStatus | "ALL";
type SortDir = "desc" | "asc";

export default function JobsList() {
  const { jobs, loading, error, lastUpdated, refresh } = useJobs(5000);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const matchesStatus =
        statusFilter === "ALL" || job.status === statusFilter;
      const matchesSearch =
        term === "" ||
        job.id.toLowerCase().includes(term) ||
        jobFileName(job).toLowerCase().includes(term) ||
        job.job_type.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
    return filtered.sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
  }, [jobs, search, statusFilter, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString()} · auto every 5s</span>
          )}
          <button
            onClick={() => refresh()}
            className="rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by id, name, or type…"
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="ALL">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Created {sortDir === "desc" ? "↓ newest" : "↑ oldest"}
        </button>
      </div>

      {error && <ErrorMessage error={error} />}
      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Exec time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="font-mono text-slate-900 underline-offset-2 hover:underline"
                      title={job.id}
                    >
                      {shortId(job.id)}
                    </Link>
                  </td>
                  <td
                    className="max-w-[180px] truncate px-4 py-3 text-slate-700"
                    title={jobFileName(job)}
                  >
                    {jobFileName(job)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {JOB_TYPE_LABELS[job.job_type]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(job.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDuration(job.execution_time)}
                  </td>
                </tr>
              ))}
              {visibleJobs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No jobs match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
