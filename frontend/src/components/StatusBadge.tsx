import type { AnyStatus } from "../utils/status";

/** Status pill for jobs, workflows and workflow tasks. */
export function StatusBadge({
  status,
  size = "sm",
}: {
  status: AnyStatus;
  size?: "sm" | "lg";
}) {
  return (
    <span className={`badge st-${status}${size === "lg" ? " badge-lg" : ""}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}
