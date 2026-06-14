import { useState } from "react";
import { Link } from "react-router-dom";
import { toApiError, uploadJob, type ApiError } from "../services/api";
import {
  JOB_TYPE_LABELS,
  JOB_TYPES,
  type Job,
  type JobType,
} from "../types/job";
import { ErrorMessage } from "./ErrorMessage";
import { StatusBadge } from "./StatusBadge";

const HELP: Record<JobType, string> = {
  CSV_ANALYSIS: "Detect columns, count rows, missing values, types and stats.",
  DATA_CLEANING: "Remove duplicate rows, trim whitespace, report missing values.",
  FILE_CONVERSION: "Convert the CSV to JSON or XLSX.",
  DATA_PROFILE_REPORT: "Generate an HTML data-profile report.",
  BULK_DATA_VALIDATION: "Validate required columns and duplicate ids.",
};

export function JobForm() {
  const [jobType, setJobType] = useState<JobType>("CSV_ANALYSIS");
  const [file, setFile] = useState<File | null>(null);

  // Per-type options.
  const [outputFormat, setOutputFormat] = useState<"json" | "xlsx">("json");
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Job type
        </label>
        <select
          value={jobType}
          onChange={(e) => {
            setJobType(e.target.value as JobType);
            setError(null);
            setCreatedJob(null);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {JOB_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP[jobType]}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          CSV file
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        {file && (
          <p className="mt-1 text-xs text-slate-500">Selected: {file.name}</p>
        )}
      </div>

      {/* Per-type options */}
      {jobType === "FILE_CONVERSION" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Output format
          </label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as "json" | "xlsx")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="json">JSON</option>
            <option value="xlsx">XLSX</option>
          </select>
        </div>
      )}

      {jobType === "BULK_DATA_VALIDATION" && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Required columns (comma-separated)
            </label>
            <input
              type="text"
              value={requiredColumns}
              onChange={(e) => setRequiredColumns(e.target.value)}
              placeholder="id, name, email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Unique id column (optional)
            </label>
            <input
              type="text"
              value={idColumn}
              onChange={(e) => setIdColumn(e.target.value)}
              placeholder="id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Uploading…" : "Upload & run"}
      </button>

      {error && <ErrorMessage error={error} />}

      {createdJob && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-green-800">Job created!</span>
            <StatusBadge status={createdJob.status} />
          </div>
          <p className="mt-1 text-green-800">
            ID: <span className="font-mono">{createdJob.id}</span>
          </p>
          <Link
            to={`/jobs/${createdJob.id}`}
            className="mt-2 inline-block font-medium text-green-700 underline hover:text-green-900"
          >
            View job details →
          </Link>
        </div>
      )}
    </form>
  );
}
