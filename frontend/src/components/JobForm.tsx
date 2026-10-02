import { useState } from "react";
import { Link } from "react-router-dom";
import { useJob } from "../hooks/useJob";
import { toApiError, uploadJob, type ApiError } from "../services/api";
import {
  JOB_TYPE_LABELS,
  JOB_TYPES,
  type Job,
  type JobType,
} from "../types/job";
import { sampleCsvFile } from "../utils/sampleCsv";
import { JOB_TYPE_HELP, JOB_TYPE_ICON } from "../utils/status";
import { ErrorMessage } from "./ErrorMessage";
import { Icon } from "./Icon";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";

const FORMATS = [
  { value: "json", label: "JSON" },
  { value: "xlsx", label: "XLSX" },
] as const;

type OutputFormat = (typeof FORMATS)[number]["value"];

/** Confirmation card that keeps following the job it just created. */
function CreatedJob({ job: created }: { job: Job }) {
  const { job: polled } = useJob(created.id, 2000);
  const job = polled ?? created;
  const progress = job.status === "PENDING" ? 0.08 : job.status === "RUNNING" ? null : 1;

  return (
    <div className="alert-success pop">
      <div className="created-head">
        <Icon name="check-circle" weight="fill" />
        <span className="created-title">Job created!</span>
        <StatusBadge status={job.status} />
      </div>
      <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
        ID: <span className="mono" style={{ fontSize: 12 }}>{job.id}</span>
      </div>
      <ProgressBar value={progress} className="progress-success" />
      <Link to={`/jobs/${job.id}`} className="arrow-link">
        View job details <Icon name="arrow-right" weight="bold" />
      </Link>
    </div>
  );
}

export function JobForm() {
  const [jobType, setJobType] = useState<JobType>("CSV_ANALYSIS");
  const [file, setFile] = useState<File | null>(null);

  // Per-type options.
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("json");
  const [requiredColumns, setRequiredColumns] = useState("");
  const [idColumn, setIdColumn] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);

  function buildOptions(): Record<string, unknown> {
    if (jobType === "FILE_CONVERSION") return { output_format: outputFormat };
    if (jobType === "BULK_DATA_VALIDATION") {
      return {
        required_columns: requiredColumns
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        id_column: idColumn.trim() || null,
      };
    }
    return {};
  }

  function pickFile(next: File | null) {
    setFile(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedJob(null);
    if (!file) {
      setError({ message: "Please choose a CSV file to upload." });
      return;
    }
    setSubmitting(true);
    try {
      const job = await uploadJob(file, jobType, buildOptions());
      setCreatedJob(job);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel job-form rise" style={{ animationDelay: ".08s" }}>
      <div className="stack" style={{ gap: 10 }}>
        <div className="label-sm">Job type</div>
        <div className="type-grid">
          {JOB_TYPES.map((t, i) => {
            const selected = t === jobType;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setJobType(t);
                  setError(null);
                  setCreatedJob(null);
                }}
                className={`type-card${selected ? " is-selected" : ""}`}
                style={{ animationDelay: `${(0.12 + i * 0.05).toFixed(2)}s` }}
              >
                <div className="type-card-top">
                  <span className={`icon-tile${selected ? " is-on" : ""}`}>
                    <Icon name={JOB_TYPE_ICON[t]} />
                  </span>
                  <span className="type-check">
                    <Icon name="check-circle" weight="fill" />
                  </span>
                </div>
                <div className="type-card-label">{JOB_TYPE_LABELS[t]}</div>
                <div className="type-card-help">{JOB_TYPE_HELP[t]}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="label-sm">CSV file</div>
        <label className={`dropzone${file ? " has-file" : ""}`}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <span className={`icon-tile icon-tile-lg${file ? " is-on" : ""}`}>
            <Icon name={file ? "file-csv" : "upload-simple"} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 14 }}>
              {file ? file.name : "Choose a CSV file"}
            </div>
            <div className="hint">
              {file ? "Ready to upload" : ".csv up to your worker’s limit"}
            </div>
          </div>
          <span className="btn btn-secondary" style={{ pointerEvents: "none", fontSize: 13 }}>
            Browse
          </span>
        </label>
        <div className="hint">
          No CSV handy?{" "}
          <button type="button" className="link" onClick={() => pickFile(sampleCsvFile())}>
            Use sample.csv
          </button>
        </div>
      </div>

      {/* Per-type options */}
      {jobType === "FILE_CONVERSION" && (
        <div className="stack rise" style={{ gap: 8, animationDuration: ".45s" }}>
          <div className="label-sm">Output format</div>
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={outputFormat === f.value}
                onClick={() => setOutputFormat(f.value)}
                className={`seg-opt${outputFormat === f.value ? " is-active" : ""}`}
                style={{ minWidth: 64, justifyContent: "center" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {jobType === "BULK_DATA_VALIDATION" && (
        <div
          className="rise"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            animationDuration: ".45s",
          }}
        >
          <div className="field">
            <label htmlFor="required-columns">Required columns (comma-separated)</label>
            <input
              id="required-columns"
              className="input"
              type="text"
              value={requiredColumns}
              onChange={(e) => setRequiredColumns(e.target.value)}
              placeholder="id, name, email"
            />
          </div>
          <div className="field">
            <label htmlFor="id-column">Unique id column (optional)</label>
            <input
              id="id-column"
              className="input"
              type="text"
              value={idColumn}
              onChange={(e) => setIdColumn(e.target.value)}
              placeholder="id"
            />
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        <div>
          <button type="submit" disabled={submitting} className="btn btn-primary btn-lg btn-glow">
            <Icon
              name={submitting ? "circle-notch" : "arrow-right"}
              weight="bold"
              spin={submitting}
            />
            {submitting ? "Uploading…" : "Upload & run"}
          </button>
        </div>
        {submitting && <ProgressBar value={null} className="progress-thin" />}
        {error && <ErrorMessage error={error} />}
        {createdJob && <CreatedJob key={createdJob.id} job={createdJob} />}
      </div>
    </form>
  );
}
