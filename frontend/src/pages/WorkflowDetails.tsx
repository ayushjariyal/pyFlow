import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { Spinner } from "../components/Spinner";
import { WorkflowBadge } from "../components/WorkflowBadge";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { useWorkflow } from "../hooks/useWorkflow";
import {
  cancelWorkflow,
  runWorkflow,
  toApiError,
  type ApiError,
} from "../services/api";
import { formatDuration } from "../utils/format";

export default function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();
  const { workflow, loading, error, refresh } = useWorkflow(id, 5000);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  async function handleRun() {
    if (!id || !file) {
      setActionError({ message: "Choose an input CSV to run the workflow." });
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await runWorkflow(id, file);
      await refresh();
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelWorkflow(id);
      await refresh();
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/workflows" className="text-sm text-slate-600 hover:underline">
        ← Back to workflows
      </Link>

      {loading && <Spinner label="Loading workflow…" />}
      {error && <ErrorMessage error={error} />}

      {workflow && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{workflow.name}</h1>
              {workflow.description && (
                <p className="text-sm text-slate-600">{workflow.description}</p>
              )}
            </div>
            <WorkflowBadge status={workflow.status} />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            {workflow.status === "PENDING" && (
              <>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                />
                <button
                  onClick={handleRun}
                  disabled={busy}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {busy ? "Running…" : "▶ Run workflow"}
                </button>
              </>
            )}
            {(workflow.status === "PENDING" || workflow.status === "RUNNING") && (
              <button
                onClick={handleCancel}
                disabled={busy}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            {workflow.status !== "PENDING" && workflow.status !== "RUNNING" && (
              <span className="text-sm text-slate-500">
                Workflow {workflow.status.toLowerCase()}.
              </span>
            )}
          </div>
          {actionError && <ErrorMessage error={actionError} />}

          {/* DAG graph */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">DAG</h2>
            <WorkflowGraph
              tasks={workflow.tasks}
              dependencies={workflow.dependencies}
            />
          </div>

          {/* Task table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Retries</th>
                  <th className="px-4 py-3">Exec time</th>
                  <th className="px-4 py-3">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workflow.tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{t.ref}</td>
                    <td className="px-4 py-3 text-slate-600">{t.task_type}</td>
                    <td className="px-4 py-3">
                      <WorkflowBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.retry_count}/{t.max_retries}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDuration(t.execution_time)}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-slate-600"
                      title={t.output_file_path ?? ""}
                    >
                      {t.output_file_path
                        ? t.output_file_path.split("/").pop()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
