import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CodeBlock } from "../components/CodeBlock";
import { Elapsed } from "../components/Elapsed";
import { ErrorMessage } from "../components/ErrorMessage";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useJob } from "../hooks/useJob";
import { downloadUrl, retryJob, toApiError, type ApiError } from "../services/api";
import { JOB_TYPE_LABELS, type Job } from "../types/job";
import {
  baseName,
  formatDateTime,
  formatDuration,
  formatTime,
  jobFileName,
  shortId,
} from "../utils/format";
import { JOB_TYPE_ICON } from "../utils/status";

const SKELETON_WIDTHS = ["62%", "84%", "45%", "70%"];

function Field({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={mono ? "mono" : undefined}>{children}</dd>
    </div>
  );
}

function Step({
  state,
  icon,
  spin = false,
  label,
  sub,
}: {
  state: string;
  icon: string;
  spin?: boolean;
  label: string;
  sub: React.ReactNode;
}) {
  return (
    <div className={`lc-step ${state}`}>
      <span className="lc-dot">
        <Icon name={icon} weight="bold" spin={spin} />
      </span>
      <div>
        <div className="lc-label">{label}</div>
        <div className="lc-sub">{sub}</div>
      </div>
    </div>
  );
}

/** Queued → Running → Succeeded/Failed stepper. */
function Lifecycle({ job }: { job: Job }) {
  const stage = job.status === "PENDING" ? 0 : job.status === "RUNNING" ? 1 : 2;
  const failed = job.status === "FAILED";

  return (
    <div className="lifecycle">
      {stage === 0 ? (
        <Step state="is-current st-RUNNING" icon="clock" label="Queued" sub={formatTime(job.created_at)} />
      ) : (
        <Step state="is-done" icon="check" label="Queued" sub={formatTime(job.created_at)} />
      )}
      <ProgressBar value={stage >= 1 ? 1 : 0} className="progress-thin lc-bar" />
      {stage === 1 ? (
        <Step
          state="is-current st-RUNNING"
          icon="circle-notch"
          spin
          label="Running"
          // updated_at is stamped when the worker picks the job up.
          sub={<Elapsed since={job.updated_at} />}
        />
      ) : stage > 1 ? (
        <Step state="is-done" icon="check" label="Running" sub="done" />
      ) : (
        <Step state="is-todo" icon="circle" label="Running" sub="—" />
      )}
      <ProgressBar value={stage === 2 ? 1 : stage === 1 ? null : 0} className="progress-thin lc-bar" />
      {stage === 2 ? (
        <Step
          state={`is-final st-${job.status}`}
          icon={failed ? "x" : "check"}
          label={failed ? "Failed" : "Succeeded"}
          sub={formatDuration(job.execution_time)}
        />
      ) : (
        <Step state="is-todo" icon="circle" label="Succeeded" sub="—" />
      )}
    </div>
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
    <div className="stack" style={{ gap: 18 }}>
      <Link to="/jobs" className="back-link">
        <Icon name="arrow-left" />
        Back to jobs
      </Link>

      {loading && <Spinner label="Loading job…" />}
      {error && <ErrorMessage error={error} />}

      {job && (
        <div className="panel job-panel rise" style={{ animationDelay: ".05s" }}>
          <div className="job-head">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="job-mark">
                <Icon name={JOB_TYPE_ICON[job.job_type]} />
              </span>
              <div>
                <div className="kicker" style={{ marginBottom: 4 }}>
                  Job · {shortId(job.id)}
                </div>
                <h1 className="job-title">{JOB_TYPE_LABELS[job.job_type]}</h1>
              </div>
            </div>
            <StatusBadge status={job.status} size="lg" />
          </div>

          <Lifecycle job={job} />

          <dl className="field-grid">
            <Field label="Job ID" mono>
              {job.id}
            </Field>
            <Field label="Input file">{jobFileName(job)}</Field>
            <Field label="Created">{formatDateTime(job.created_at)}</Field>
            <Field label="Execution time">
              {formatDuration(job.execution_time)}
            </Field>
          </dl>

          {/* Download generated output, when present */}
          {job.output_file_path && job.status === "SUCCESS" && (
            <div className="download-row pop">
              <a href={downloadUrl(job.id)} className="btn btn-primary btn-lg btn-glow">
                <Icon name="download-simple" weight="bold" />
                Download output
              </a>
              <span className="mono hint">{baseName(job.output_file_path)}</span>
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <div className="eyebrow">Options</div>
            <CodeBlock value={job.payload} />
          </div>

          {job.status === "FAILED" ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="eyebrow" style={{ color: "oklch(0.78 0.11 22)" }}>
                Error
              </div>
              <div className="alert-error">
                <Icon name="warning-circle" weight="bold" />
                <div>
                  {typeof job.result?.error === "string"
                    ? job.result.error
                    : "The job failed. See details below."}
                </div>
              </div>
              {job.result && <CodeBlock value={job.result} />}
              <div>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="btn btn-primary btn-lg"
                >
                  <Icon
                    name="arrow-counter-clockwise"
                    weight="bold"
                    style={
                      retrying
                        ? { display: "inline-block", animation: "spin .9s linear infinite reverse" }
                        : undefined
                    }
                  />
                  {retrying ? "Retrying…" : "Retry job"}
                </button>
              </div>
              {retryError && <ErrorMessage error={retryError} />}
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <div className="eyebrow">Result</div>
              {job.result ? (
                <CodeBlock value={job.result} className="rise" />
              ) : (
                <div className="skeleton-box">
                  {SKELETON_WIDTHS.map((w) => (
                    <div key={w} className="skeleton-line" style={{ width: w }} />
                  ))}
                  <div className="hint" style={{ marginTop: 4, fontSize: 13 }}>
                    No result yet (job is {job.status.toLowerCase()}).
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
