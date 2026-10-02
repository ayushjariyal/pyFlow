import type { ApiError } from "../services/api";
import { Icon } from "./Icon";

/** Renders an ApiError, including structured validation details if present. */
export function ErrorMessage({ error }: { error: ApiError }) {
  return (
    <div className="alert-error pop" role="alert">
      <Icon name="warning-circle" weight="bold" />
      <div>
        {error.message}
        {error.details != null && <pre>{JSON.stringify(error.details, null, 2)}</pre>}
      </div>
    </div>
  );
}
