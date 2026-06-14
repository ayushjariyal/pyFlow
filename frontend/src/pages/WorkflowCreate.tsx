import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { createWorkflow, toApiError, type ApiError } from "../services/api";
import { JOB_TYPE_LABELS, JOB_TYPES } from "../types/job";

const TEMPLATE = JSON.stringify(
  {
    name: "Data Analysis Pipeline",
    description: "Clean a CSV, then profile the cleaned data.",
    tasks: [
      { id: "clean", type: "DATA_CLEANING" },
      { id: "profile", type: "DATA_PROFILE_REPORT" },
    ],
    dependencies: [{ from: "clean", to: "profile" }],
  },
  null,
  2,
);

// A fuller, known-good example using ALL five task types. `analyze` runs on the
// raw upload; `clean` produces a cleaned CSV that profile/convert/validate then
// process in parallel.
const EXAMPLE = JSON.stringify(
  {
    name: "Full Data Pipeline",
    description: "Analyze raw data, clean it, then profile, convert and validate the cleaned output.",
    tasks: [
      { id: "analyze", type: "CSV_ANALYSIS" },
      { id: "clean", type: "DATA_CLEANING" },
      { id: "profile", type: "DATA_PROFILE_REPORT" },
      {
        id: "convert",
        type: "FILE_CONVERSION",
        payload: { output_format: "xlsx" },
      },
      {
        id: "validate",
        type: "BULK_DATA_VALIDATION",
        payload: { required_columns: ["id"], id_column: "id" },
      },
    ],
    dependencies: [
      { from: "clean", to: "profile" },
      { from: "clean", to: "convert" },
      { from: "clean", to: "validate" },
    ],
  },
  null,
  2,
);

const VALID_TYPES = new Set<string>(JOB_TYPES);

/**
 * Lightweight client-side validation so wrong `type`/`id`/`from`/`to` values get
 * a clear message before hitting the server (the server still does the full DAG
 * validation: cycles, self-deps, option schemas).
 */
function validateDefinition(def: unknown): string | null {
  if (typeof def !== "object" || def === null || Array.isArray(def)) {
    return "Definition must be a JSON object.";
  }
  const d = def as Record<string, unknown>;
  if (typeof d.name !== "string" || !d.name.trim()) {
    return '"name" is required.';
  }
  if (!Array.isArray(d.tasks) || d.tasks.length === 0) {
    return '"tasks" must be a non-empty array.';
  }

  const ids = new Set<string>();
  for (const t of d.tasks as Record<string, unknown>[]) {
    if (typeof t?.id !== "string" || !t.id.trim()) {
      return "Every task needs a non-empty string \"id\".";
    }
    if (ids.has(t.id)) return `Duplicate task id: "${t.id}".`;
    ids.add(t.id);
    if (typeof t?.type !== "string" || !VALID_TYPES.has(t.type)) {
      return `Task "${t.id}" has an invalid type: ${JSON.stringify(
        t?.type,
      )}. Valid types: ${JOB_TYPES.join(", ")}.`;
    }
  }

  const deps = d.dependencies ?? [];
  if (!Array.isArray(deps)) return '"dependencies" must be an array.';
  for (const dep of deps as Record<string, unknown>[]) {
    const from = dep?.from;
    const to = dep?.to;
    if (typeof from !== "string" || typeof to !== "string") {
      return 'Each dependency needs string "from" and "to".';
    }
    if (!ids.has(from)) return `Dependency "from" references unknown task: "${from}".`;
    if (!ids.has(to)) return `Dependency "to" references unknown task: "${to}".`;
  }
  return null;
}

export default function WorkflowCreate() {
  const navigate = useNavigate();
  const [text, setText] = useState(TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let def: unknown;
    try {
      def = JSON.parse(text);
    } catch {
      setError({ message: "Definition is not valid JSON. Check for missing commas or quotes." });
      return;
    }

    const problem = validateDefinition(def);
    if (problem) {
      setError({ message: problem });
      return;
    }

    setSubmitting(true);
    try {
      // The server does the full DAG validation (cycles, refs, option schemas).
      const wf = await createWorkflow(def as never);
      navigate(`/workflows/${wf.id}`);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">New workflow</h1>
      <p className="text-sm text-slate-600">
        Define the DAG as JSON: a list of <code>tasks</code> (each with an{" "}
        <code>id</code> and a <code>type</code>) and <code>dependencies</code>{" "}
        (<code>from</code> → <code>to</code>). The server rejects cycles, self-
        dependencies, and unknown references.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Workflow definition (JSON)
          </label>
          <button
            type="button"
            onClick={() => {
              setText(EXAMPLE);
              setError(null);
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Load example
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        {error && <ErrorMessage error={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create workflow"}
        </button>
      </form>

      {/* --- Reference: valid task types + a known-good example --- */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Valid task <code>type</code> values
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {JOB_TYPES.map((t) => (
              <span
                key={t}
                title={JOB_TYPE_LABELS[t]}
                className="rounded-full bg-white px-2.5 py-1 font-mono text-xs text-slate-700 ring-1 ring-inset ring-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Per-task options go in an optional <code>payload</code> — e.g.{" "}
            <code>{'{"output_format": "xlsx"}'}</code> for FILE_CONVERSION, or{" "}
            <code>{'{"required_columns": ["id"], "id_column": "id"}'}</code> for
            BULK_DATA_VALIDATION.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-800">Example</h2>
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
            {EXAMPLE}
          </pre>
          <p className="mt-1 text-xs text-slate-500">
            Tip: common mistakes are using a comma vs. a period between fields,
            and a type that isn't in the list above. Use “Load example” to start
            from a valid definition.
          </p>
        </div>
      </div>
    </div>
  );
}
