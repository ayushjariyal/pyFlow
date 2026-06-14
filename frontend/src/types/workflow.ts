import type { JobType, JsonObject } from "./job";

export type WorkflowStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskStatus =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED";

export interface WorkflowTask {
  id: string;
  ref: string;
  task_type: JobType;
  status: TaskStatus;
  payload: JsonObject;
  result: JsonObject | null;
  execution_time: number | null;
  input_file_path: string | null;
  output_file_path: string | null;
  retry_count: number;
  max_retries: number;
  retry_delay: number;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  from: string;
  to: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  input_file_path: string | null;
  created_at: string;
  updated_at: string;
  tasks: WorkflowTask[];
  dependencies: Edge[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  task_count: number;
}

export interface WorkflowMetrics {
  total: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
  cancelled: number;
  success_rate: number;
  failure_rate: number;
  avg_completion_seconds: number | null;
}

// Shape posted to POST /workflows.
export interface WorkflowDefinition {
  name: string;
  description?: string;
  tasks: { id: string; type: JobType; payload?: JsonObject; max_retries?: number; retry_delay?: number }[];
  dependencies: { from: string; to: string }[];
}
