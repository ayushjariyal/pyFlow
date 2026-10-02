import { JobForm } from "../components/JobForm";

export default function Dashboard() {
  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="page-intro rise">
        <div className="kicker kicker-line">New job</div>
        <h1 className="page-title" style={{ marginBottom: 12 }}>
          Dashboard
        </h1>
        <p className="lede">
          Upload a CSV and run a data-processing job. It's queued and executed
          asynchronously by a worker — track progress and download results from
          the Jobs page.
        </p>
      </div>

      <JobForm />
    </div>
  );
}
