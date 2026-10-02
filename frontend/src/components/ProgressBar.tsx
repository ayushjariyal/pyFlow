/**
 * Thin progress track. `value` is 0–1; pass `null` when the amount of work is
 * unknown (the API reports status, not percent) to show an indeterminate sweep.
 */
export function ProgressBar({
  value,
  className = "",
  width,
}: {
  value: number | null;
  className?: string;
  width?: number;
}) {
  const indeterminate = value == null;
  return (
    <div
      className={`progress${indeterminate ? " is-indeterminate" : ""}${className ? ` ${className}` : ""}`}
      style={width ? { width } : undefined}
    >
      <div
        className="progress-fill"
        style={indeterminate ? undefined : { width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
      />
    </div>
  );
}
