import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useJob } from "../hooks/useJob";
import { downloadUrl, retryJob, toApiError, type ApiError } from "../services/api";
import { JOB_TYPE_LABELS } from "../types/job";
import { formatDateTime, formatDuration, jobFileName } from "../utils/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { job, loading, error, refresh } = useJob(id, 5000);

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<ApiError | null>(null);

  async function handleRetry() {
    if (!id) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await retryJob(id);
      await refresh();
    } catch (err) {
      setRetryError(toApiError(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/jobs" className="text-sm text-slate-600 hover:underline">
        ← Back to jobs
      </Link>

      {loading && <Spinner label="Loading job…" />}
      {error && <ErrorMessage error={error} />}

      {job && (
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">
              {JOB_TYPE_LABELS[job.job_type]}
            </h1>
            <StatusBadge status={job.status} />
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job ID">
              <span className="font-mono break-all">{job.id}</span>
            </Field>
            <Field label="Input file">{jobFileName(job)}</Field>
            <Field label="Created">{formatDateTime(job.created_at)}</Field>
            <Field label="Execution time">
              {formatDuration(job.execution_time)}
            </Field>
          </dl>

          {/* Download generated output, when present */}
          {job.output_file_path && job.status === "SUCCESS" && (
            <div>
              <a
                href={downloadUrl(job.id)}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                ⬇ Download output
              </a>
              <span className="ml-2 text-xs text-slate-500">
                {job.output_file_path.split("/").pop()}
              </span>
            </div>
          )}

          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-700">
              Options
            </h2>
            <JsonBlock value={job.payload} />
          </div>

          {job.status === "FAILED" ? (
            <div>
              <h2 className="mb-1 text-sm font-semibold text-red-700">Error</h2>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {typeof job.result?.error === "string"
                  ? job.result.error
                  : "The job failed. See details below."}
              </div>
              {job.result && (
                <div className="mt-2">
                  <JsonBlock value={job.result} />
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-700">
                Result
              </h2>
              {job.result ? (
                <JsonBlock value={job.result} />
              ) : (
                <p className="text-sm text-slate-500">
                  No result yet (job is {job.status.toLowerCase()}).
                </p>
              )}
            </div>
          )}

          {job.status === "FAILED" && (
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {retrying ? "Retrying…" : "Retry job"}
              </button>
              {retryError && <ErrorMessage error={retryError} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
