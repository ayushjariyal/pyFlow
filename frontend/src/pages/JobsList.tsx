import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Elapsed } from "../components/Elapsed";
import { ErrorMessage } from "../components/ErrorMessage";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useJobs } from "../hooks/useJobs";
import {
  JOB_STATUSES,
  JOB_TYPE_LABELS,
  type Job,
  type JobStatus,
} from "../types/job";
import {
  formatDateTime,
  formatDuration,
  formatTime,
  jobFileName,
  shortId,
} from "../utils/format";
import { JOB_TYPE_ICON } from "../utils/status";

type StatusFilter = JobStatus | "ALL";
type SortDir = "desc" | "asc";

const FILTERS: StatusFilter[] = ["ALL", ...JOB_STATUSES];
const FLASH_MS = 1600;

function filterLabel(f: StatusFilter): string {
  return f === "ALL" ? "All" : f[0] + f.slice(1).toLowerCase();
}

/**
 * Ids of jobs whose status changed (or that appeared) in the latest poll,
 * mapped to the new status, so their rows can flash briefly.
 */
function useStatusFlashes(jobs: Job[]): Record<string, JobStatus> {
  const known = useRef(new Map<string, JobStatus>());
  const [flashes, setFlashes] = useState<Record<string, JobStatus>>({});

  useEffect(() => {
    const firstLoad = known.current.size === 0;
    const changed: Record<string, JobStatus> = {};
    for (const job of jobs) {
      if (!firstLoad && known.current.get(job.id) !== job.status) changed[job.id] = job.status;
      known.current.set(job.id, job.status);
    }
    if (Object.keys(changed).length === 0) return;
    setFlashes(changed);
    const timer = window.setTimeout(() => setFlashes({}), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [jobs]);

  return flashes;
}

export default function JobsList() {
  const navigate = useNavigate();
  const { jobs, loading, error, lastUpdated, refresh } = useJobs(5000);
  const flashes = useStatusFlashes(jobs);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshTurns, setRefreshTurns] = useState(0);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { ALL: jobs.length, PENDING: 0, RUNNING: 0, SUCCESS: 0, FAILED: 0 };
    jobs.forEach((j) => c[j.status]++);
    return c;
  }, [jobs]);

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
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head rise">
        <div>
          <div className="kicker kicker-line">
            {jobs.length} jobs · {counts.RUNNING} running
          </div>
          <h1 className="page-title">Jobs</h1>
        </div>
        <div className="poll-status">
          {lastUpdated && (
            <>
              <svg className="poll-ring" width="18" height="18" viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" />
                {/* Re-keyed on every fetch so the 5s countdown restarts. */}
                <circle key={lastUpdated.getTime()} className="poll-ring-arc" cx="9" cy="9" r="7" />
              </svg>
              <span>Updated {formatTime(lastUpdated)} · auto every 5s</span>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setRefreshTurns((n) => n + 1);
              refresh();
            }}
          >
            <Icon
              name="arrows-clockwise"
              weight="bold"
              style={{
                display: "inline-block",
                transform: `rotate(${refreshTurns * 360}deg)`,
                transition: "transform .7s cubic-bezier(.2,.8,.2,1)",
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="toolbar rise" style={{ animationDelay: ".06s" }}>
        <div className="search">
          <Icon name="magnifying-glass" />
          <input
            className="input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, name, or type…"
            aria-label="Search jobs"
          />
        </div>
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={statusFilter === f}
              onClick={() => setStatusFilter(f)}
              className={`seg-opt${statusFilter === f ? " is-active" : ""}`}
            >
              {filterLabel(f)}
              <span className="seg-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "7px 12px", fontSize: 13 }}
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
        >
          Created{" "}
          <Icon
            name="arrow-down"
            weight="bold"
            style={{
              display: "inline-block",
              transform: `rotate(${sortDir === "desc" ? 0 : 180}deg)`,
              transition: "transform .45s cubic-bezier(.34,1.56,.64,1)",
            }}
          />
          {sortDir === "desc" ? "newest" : "oldest"}
        </button>
      </div>

      {error && <ErrorMessage error={error} />}
      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : (
        <div className="panel table-panel rise" style={{ animationDelay: ".12s" }}>
          <table className="table table-roomy" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>File</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Exec time</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job, i) => (
                <tr
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className={`row-link${flashes[job.id] ? ` flash-${flashes[job.id]}` : ""}`}
                  style={{ animationDelay: `${(0.16 + Math.min(i, 14) * 0.035).toFixed(3)}s` }}
                >
                  <td>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="id-link"
                      title={job.id}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortId(job.id)}
                    </Link>
                  </td>
                  <td className="truncate" style={{ maxWidth: 180 }} title={jobFileName(job)}>
                    {jobFileName(job)}
                  </td>
                  <td>
                    <span className="type-cell">
                      <Icon name={JOB_TYPE_ICON[job.job_type]} />
                      {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="cell-dim">{formatDateTime(job.created_at)}</td>
                  <td>
                    {job.status === "RUNNING" ? (
                      <div className="exec-live">
                        <ProgressBar value={null} width={72} />
                        <span className="cell-elapsed">
                          <Elapsed since={job.updated_at} />
                        </span>
                      </div>
                    ) : job.status === "PENDING" ? (
                      <span className="hint">queued…</span>
                    ) : (
                      <span className="cell-exec">{formatDuration(job.execution_time)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleJobs.length === 0 && (
            <div className="table-empty">No jobs match your filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
