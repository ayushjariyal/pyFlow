import { Link } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { Spinner } from "../components/Spinner";
import { WorkflowBadge } from "../components/WorkflowBadge";
import { useWorkflows } from "../hooks/useWorkflows";
import type { WorkflowMetrics } from "../types/workflow";
import { formatDateTime, shortId } from "../utils/format";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Metrics({ m }: { m: WorkflowMetrics }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const avg =
    m.avg_completion_seconds == null
      ? "—"
      : `${m.avg_completion_seconds.toFixed(1)}s`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard label="Success rate" value={pct(m.success_rate)} />
      <MetricCard label="Failure rate" value={pct(m.failure_rate)} />
      <MetricCard label="Avg time" value={avg} />
      <MetricCard label="Running" value={String(m.running)} />
      <MetricCard label="Completed" value={String(m.completed)} />
      <MetricCard label="Total" value={String(m.total)} />
    </div>
  );
}

export default function WorkflowsList() {
  const { workflows, metrics, loading, error } = useWorkflows(5000);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
        <Link
          to="/workflows/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + New workflow
        </Link>
      </div>

      {error && <ErrorMessage error={error} />}
      {metrics && <Metrics m={metrics} />}

      {loading ? (
        <Spinner label="Loading workflows…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tasks</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/workflows/${w.id}`}
                      className="font-mono text-slate-900 hover:underline"
                      title={w.id}
                    >
                      {shortId(w.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{w.name}</td>
                  <td className="px-4 py-3">
                    <WorkflowBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.task_count}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(w.created_at)}
                  </td>
                </tr>
              ))}
              {workflows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No workflows yet. Create one to get started.
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
