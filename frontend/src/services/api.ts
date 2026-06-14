// Centralized Axios API client + typed wrappers for every backend endpoint.

import axios from "axios";
import type { Job, JobType } from "../types/job";
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowMetrics,
  WorkflowSummary,
} from "../types/workflow";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const apiClient = axios.create({ baseURL });

/** Normalised, UI-friendly error shape produced from any thrown error. */
export interface ApiError {
  message: string;
  details?: unknown;
  status?: number;
}

/**
 * Turn any caught error into an ApiError. Distinguishes API errors (server
 * responded), network errors (no response — backend down / CORS), and others.
 */
export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const data = err.response.data as
        | { detail?: unknown; errors?: unknown }
        | undefined;
      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : `Request failed with status ${err.response.status}`;
      return {
        message,
        details: data?.errors ?? (typeof detail === "string" ? undefined : detail),
        status: err.response.status,
      };
    }
    if (err.request) {
      return {
        message:
          "Network error: couldn't reach the API. Is the backend running on " +
          `${baseURL}?`,
      };
    }
  }
  return { message: err instanceof Error ? err.message : "Unknown error" };
}

export async function listJobs(): Promise<Job[]> {
  const { data } = await apiClient.get<Job[]>("/jobs", {
    params: { limit: 500 },
  });
  return data;
}

export async function getJob(id: string): Promise<Job> {
  const { data } = await apiClient.get<Job>(`/jobs/${id}`);
  return data;
}

/** Upload a file and create a processing job in one request. */
export async function uploadJob(
  file: File,
  jobType: JobType,
  options: Record<string, unknown>,
): Promise<Job> {
  const form = new FormData();
  form.append("file", file);
  form.append("job_type", jobType);
  form.append("options", JSON.stringify(options ?? {}));
  const { data } = await apiClient.post<Job>("/jobs/upload", form);
  return data;
}

export async function retryJob(id: string): Promise<Job> {
  const { data } = await apiClient.post<Job>(`/jobs/${id}/retry`);
  return data;
}

/** Direct URL to a job's downloadable output file. */
export function downloadUrl(id: string): string {
  return `${baseURL}/jobs/${id}/download`;
}

// --- Workflows ------------------------------------------------------------
export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const { data } = await apiClient.get<WorkflowSummary[]>("/workflows", {
    params: { limit: 500 },
  });
  return data;
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const { data } = await apiClient.get<Workflow>(`/workflows/${id}`);
  return data;
}

export async function getWorkflowMetrics(): Promise<WorkflowMetrics> {
  const { data } = await apiClient.get<WorkflowMetrics>("/workflows/metrics");
  return data;
}

export async function createWorkflow(def: WorkflowDefinition): Promise<Workflow> {
  const { data } = await apiClient.post<Workflow>("/workflows", def);
  return data;
}

export async function runWorkflow(id: string, file: File): Promise<Workflow> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<Workflow>(`/workflows/${id}/run`, form);
  return data;
}

export async function cancelWorkflow(id: string): Promise<Workflow> {
  const { data } = await apiClient.post<Workflow>(`/workflows/${id}/cancel`);
  return data;
}
