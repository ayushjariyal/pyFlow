import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Elapsed } from "../components/Elapsed";
import { ErrorMessage } from "../components/ErrorMessage";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { useWorkflow } from "../hooks/useWorkflow";
import {
  cancelWorkflow,
  runWorkflow,
  toApiError,
  type ApiError,
} from "../services/api";
import type { Workflow } from "../types/workflow";
import type { DagTask } from "../utils/dag";
import { baseName, formatDuration, shortId } from "../utils/format";
import { sampleCsvFile } from "../utils/sampleCsv";

const FINAL_ICON: Record<string, string> = {
  COMPLETED: "check-circle",
  FAILED: "x-circle",
  CANCELLED: "prohibit",
};

/** "5 tasks in 9.2s" for a completed workflow (created → last update). */
function completionNote(workflow: Workflow, done: number): string {
  if (workflow.status !== "COMPLETED") return "";
  const secs =
    (new Date(workflow.updated_at).getTime() - new Date(workflow.created_at).getTime()) / 1000;
  return Number.isFinite(secs) && secs > 0 ? `${done} tasks in ${secs.toFixed(1)}s` : "";
}

export default function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();
  const { workflow, loading, error, refresh } = useWorkflow(id, 5000);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const dagTasks = useMemo(
    () =>
      (workflow?.tasks ?? []).map(
        (t): DagTask => ({ ref: t.ref, type: t.task_type, status: t.status }),
      ),
    [workflow?.tasks],
  );

  function pickFile(next: File | null) {
    setFile(next);
    setActionError(null);
  }

  async function handleRun() {
    if (!id || !file) {
      setActionError({ message: "Choose an input CSV to run the workflow." });
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await runWorkflow(id, file);
      setFile(null);
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

  const done = workflow?.tasks.filter((t) => t.status === "SUCCESS").length ?? 0;
  const total = workflow?.tasks.length ?? 0;
  const isPending = workflow?.status === "PENDING";
  const isRunning = workflow?.status === "RUNNING";

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link to="/workflows" className="back-link">
        <Icon name="arrow-left" />
        Back to workflows
      </Link>

      {loading && <Spinner label="Loading workflow…" />}
      {error && <ErrorMessage error={error} />}

      {workflow && (
        <>
          <div className="wf-head rise">
            <div style={{ maxWidth: 720 }}>
              <div className="kicker kicker-line">Workflow · {shortId(workflow.id)}</div>
              <h1 className="wf-title">{workflow.name}</h1>
              {workflow.description && <p className="lede">{workflow.description}</p>}
            </div>
            <StatusBadge status={workflow.status} size="lg" />
          </div>

          {/* Actions */}
          <div className="panel action-bar rise" style={{ animationDelay: ".06s" }}>
            {isPending && (
              <>
                <div className={`dropzone dropzone-sm${file ? " has-file" : ""}`}>
                  <label className="dropzone-label">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                    <Icon name={file ? "file-csv" : "upload-simple"} />
                    <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      {file ? file.name : "Choose an input CSV…"}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="link"
                    style={{ fontSize: 12, whiteSpace: "nowrap" }}
                    onClick={() => pickFile(sampleCsvFile())}
                  >
                    Use sample.csv
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={busy}
                  className="btn btn-primary btn-lg btn-glow"
                >
                  {busy ? (
                    <Icon name="circle-notch" weight="bold" spin />
                  ) : (
                    <Icon name="play" weight="fill" />
                  )}
                  {busy ? "Running…" : "Run workflow"}
                </button>
              </>
            )}
            {isRunning && (
              <div className="run-progress">
                <div className="run-progress-head">
                  <span>
                    <Icon name="circle-notch" weight="bold" spin />
                    Running
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                    }}
                  >
                    {done} of {total} tasks done
                  </span>
                </div>
                <ProgressBar value={total ? done / total : 0} />
              </div>
            )}
            {(isPending || isRunning) && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="btn btn-secondary"
                style={{ padding: "9px 14px" }}
              >
                <Icon name="stop" />
                Cancel
              </button>
            )}
            {!isPending && !isRunning && (
              <span className={`final-note st-${workflow.status}`}>
                <Icon name={FINAL_ICON[workflow.status] ?? "prohibit"} weight="fill" />
                Workflow {workflow.status.toLowerCase()}.
                <span>{completionNote(workflow, done)}</span>
              </span>
            )}
          </div>
          {actionError && <ErrorMessage error={actionError} />}

          {/* DAG graph */}
          <div className="stack rise" style={{ gap: 10, animationDelay: ".12s" }}>
            <div className="eyebrow">DAG</div>
            <WorkflowGraph tasks={dagTasks} dependencies={workflow.dependencies} />
          </div>

          {/* Task table */}
          <div className="panel table-panel rise" style={{ animationDelay: ".18s" }}>
            <table className="table table-roomy" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Exec time</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {workflow.tasks.map((t, i) => (
                  <tr
                    key={t.id}
                    className="rise"
                    style={{ animationDuration: ".5s", animationDelay: `${(0.25 + i * 0.05).toFixed(2)}s` }}
                  >
                    <td style={{ fontWeight: 500 }}>{t.ref}</td>
                    <td
                      className="mono"
                      style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 62%, transparent)" }}
                    >
                      {t.task_type}
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color: "color-mix(in srgb, var(--color-text) 62%, transparent)",
                      }}
                    >
                      {t.retry_count}/{t.max_retries}
                    </td>
                    <td>
                      {t.status === "RUNNING" ? (
                        <div className="exec-live">
                          <ProgressBar value={null} width={64} />
                          <span className="cell-elapsed">
                            <Elapsed since={t.updated_at} />
                          </span>
                        </div>
                      ) : (
                        <span className="cell-exec">{formatDuration(t.execution_time)}</span>
                      )}
                    </td>
                    <td
                      className="mono truncate"
                      style={{
                        maxWidth: 220,
                        fontSize: 12,
                        color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
                      }}
                      title={t.output_file_path ?? ""}
                    >
                      {t.output_file_path ? baseName(t.output_file_path) : "—"}
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
