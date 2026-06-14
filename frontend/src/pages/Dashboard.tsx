import { JobForm } from "../components/JobForm";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a CSV and run a data-processing job. It's queued and executed
          asynchronously by a worker — track progress and download results from
          the Jobs page.
        </p>
      </div>

      <div className="max-w-2xl">
        <JobForm />
      </div>
    </div>
  );
}
