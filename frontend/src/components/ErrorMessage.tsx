import type { ApiError } from "../services/api";

/** Renders an ApiError, including structured validation details if present. */
export function ErrorMessage({ error }: { error: ApiError }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">{error.message}</p>
      {error.details != null && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-red-700">
          {JSON.stringify(error.details, null, 2)}
        </pre>
      )}
    </div>
  );
}
