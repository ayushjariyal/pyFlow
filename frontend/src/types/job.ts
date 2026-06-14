// Mirrors the backend's JobStatus / JobType enums and JobRead schema.

export type JobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export type JobType =
  | "CSV_ANALYSIS"
  | "DATA_CLEANING"
  | "FILE_CONVERSION"
  | "DATA_PROFILE_REPORT"
  | "BULK_DATA_VALIDATION";

export const JOB_STATUSES: JobStatus[] = [
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILED",
];

// Human-friendly labels for the job types.
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  CSV_ANALYSIS: "CSV Analysis",
  DATA_CLEANING: "Data Cleaning",
  FILE_CONVERSION: "File Conversion",
  DATA_PROFILE_REPORT: "Data Profile Report",
  BULK_DATA_VALIDATION: "Bulk Data Validation",
};

export const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];

export type JsonObject = Record<string, unknown>;

export interface Job {
  id: string;
  task_name: string;
  job_type: JobType;
  payload: JsonObject;
  status: JobStatus;
  result: JsonObject | null;
  execution_time: number | null;
  input_file_path: string | null;
  output_file_path: string | null;
  job_metadata: JsonObject | null;
  celery_task_id: string | null;
  created_at: string;
  updated_at: string;
}
