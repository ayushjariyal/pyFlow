import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import JobDetails from "./pages/JobDetails";
import JobsList from "./pages/JobsList";
import WorkflowCreate from "./pages/WorkflowCreate";
import WorkflowDetails from "./pages/WorkflowDetails";
import WorkflowsList from "./pages/WorkflowsList";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<JobsList />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/workflows" element={<WorkflowsList />} />
        <Route path="/workflows/new" element={<WorkflowCreate />} />
        <Route path="/workflows/:id" element={<WorkflowDetails />} />
        {/* Unknown routes fall back to the dashboard. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
