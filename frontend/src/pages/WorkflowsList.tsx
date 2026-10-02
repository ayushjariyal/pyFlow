import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useCountUp } from "../hooks/useCountUp";
import { useWorkflowTaskStatuses } from "../hooks/useWorkflowTaskStatuses";
import { useWorkflows } from "../hooks/useWorkflows";
import type {
  TaskStatus,
  WorkflowMetrics,
  WorkflowSummary,
} from "../types/workflow";
import { formatDateTime, shortId } from "../utils/format";

const RING_LENGTH = 94.25; // circumference of the r=15 metric ring
const OK = "oklch(0.76 0.13 160)";
const BAD = "oklch(0.7 0.15 22)";

function MetricCard({
  label,
  value,
  color = "var(--color-accent-700)",
  ring,
  live = false,
  index,
}: {
  label: string;
  value: string;
  color?: string;
  /** 0–1 share drawn as a ring next to the value. */
  ring?: number;
  live?: boolean;
  index: number;
}) {
  return (
    <div
      className="metric-card"
      style={{ "--metric-color": color, animationDelay: `${(0.06 + index * 0.05).toFixed(2)}s` } as CSSProperties}
    >
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {live && <span className="live-dot is-live" />}
      </div>
      <div className="metric-body">
        <span className="metric-value">{value}</span>
        {ring != null && (
          <svg className="metric-ring" width="34" height="34" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" />
            <circle
              className="metric-ring-arc"
              cx="18"
              cy="18"
              r="15"
              style={{ strokeDashoffset: (RING_LENGTH * (1 - ring)).toFixed(2) }}
            />
          </svg>
        )}
      </div>
      <div className="metric-line" />
    </div>
  );
}

function Metrics({ m }: { m: WorkflowMetrics }) {
  const k = useCountUp();
  const pct = (v: number) => `${Math.round(v * 100 * k)}%`;
  const count = (v: number) => String(Math.round(v * k));
  const avg =
    m.avg_completion_seconds == null
      ? "—"
      : `${(m.avg_completion_seconds * k).toFixed(1)}s`;
  return (
    <div className="metric-grid">
      <MetricCard index={0} label="Success rate" value={pct(m.success_rate)} ring={m.success_rate * k} color={OK} />
      <MetricCard index={1} label="Failure rate" value={pct(m.failure_rate)} ring={m.failure_rate * k} color={BAD} />
      <MetricCard index={2} label="Avg time" value={avg} />
      <MetricCard index={3} label="Running" value={count(m.running)} live={m.running > 0} color="var(--color-accent)" />
      <MetricCard index={4} label="Completed" value={count(m.completed)} />
      <MetricCard index={5} label="Total" value={count(m.total)} />
    </div>
  );
}

/** One segment per task, coloured by task status. */
function TaskSegments({
  workflow,
  tasks,
}: {
  workflow: WorkflowSummary;
  tasks: TaskStatus[] | undefined;
}) {
  // Completed / untouched workflows have uniform tasks; otherwise use the
  // fetched per-task statuses, falling back to the workflow's own colour.
  const uniform: TaskStatus | null =
    workflow.status === "COMPLETED" ? "SUCCESS" : workflow.status === "PENDING" ? "PENDING" : null;
  const segments: string[] = uniform
    ? Array<string>(workflow.task_count).fill(uniform)
    : tasks ?? Array<string>(workflow.task_count).fill(workflow.status);
  const done = tasks?.filter((s) => s === "SUCCESS").length;

  return (
    <div className="task-segs">
      <div className="task-segs-bar">
        {segments.map((s, i) => (
          <span key={i} className={`task-seg st-${s}`} />
        ))}
      </div>
      <span className="task-segs-label">
        {workflow.status === "RUNNING" && done != null
          ? `${done}/${workflow.task_count}`
          : workflow.task_count}
      </span>
    </div>
  );
}

export default function WorkflowsList() {
  const navigate = useNavigate();
  const { workflows, metrics, loading, error } = useWorkflows(5000);
  const taskStatuses = useWorkflowTaskStatuses(workflows);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head rise">
        <div>
          <div className="kicker kicker-line">DAG engine</div>
          <h1 className="page-title">Workflows</h1>
        </div>
        <Link to="/workflows/new" className="btn btn-primary btn-lg btn-glow">
          <Icon name="plus" weight="bold" />
          New workflow
        </Link>
      </div>

      {error && <ErrorMessage error={error} />}
      {metrics && <Metrics m={metrics} />}

      {loading ? (
        <Spinner label="Loading workflows…" />
      ) : (
        <div className="panel table-panel rise" style={{ animationDelay: ".2s" }}>
          <table className="table table-roomy" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w, i) => (
                <tr
                  key={w.id}
                  onClick={() => navigate(`/workflows/${w.id}`)}
                  className="row-link"
                  style={{ animationDelay: `${(0.3 + Math.min(i, 14) * 0.04).toFixed(2)}s` }}
                >
                  <td>
                    <Link
                      to={`/workflows/${w.id}`}
                      className="id-link"
                      title={w.id}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortId(w.id)}
                    </Link>
                  </td>
                  <td>{w.name}</td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>
                    <TaskSegments workflow={w} tasks={taskStatuses[w.id]} />
                  </td>
                  <td className="cell-dim">{formatDateTime(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {workflows.length === 0 && (
            <div className="table-empty">No workflows yet. Create one to get started.</div>
          )}
        </div>
      )}
    </div>
  );
}
