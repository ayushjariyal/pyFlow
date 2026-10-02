// Shared status + job-type presentation. Colours live in styles/app.css as
// `.st-<STATUS>` classes; this file only maps statuses/types to Phosphor icons.

import type { JobStatus, JobType } from "../types/job";
import type { TaskStatus, WorkflowStatus } from "../types/workflow";

export type AnyStatus = JobStatus | WorkflowStatus | TaskStatus;

export const STATUS_ICON: Record<AnyStatus, string> = {
  PENDING: "clock",
  READY: "lightning",
  RUNNING: "circle-notch",
  SUCCESS: "check",
  COMPLETED: "check",
  FAILED: "x",
  CANCELLED: "prohibit",
  SKIPPED: "minus",
};

export const JOB_TYPE_ICON: Record<JobType, string> = {
  CSV_ANALYSIS: "chart-bar",
  DATA_CLEANING: "broom",
  FILE_CONVERSION: "arrows-left-right",
  DATA_PROFILE_REPORT: "file-html",
  BULK_DATA_VALIDATION: "shield-check",
};

export const JOB_TYPE_HELP: Record<JobType, string> = {
  CSV_ANALYSIS: "Detect columns, count rows, missing values, types and stats.",
  DATA_CLEANING: "Remove duplicate rows, trim whitespace, report missing values.",
  FILE_CONVERSION: "Convert the CSV to JSON or XLSX.",
  DATA_PROFILE_REPORT: "Generate an HTML data-profile report.",
  BULK_DATA_VALIDATION: "Validate required columns and duplicate ids.",
};
