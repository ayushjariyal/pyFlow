import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CodeBlock } from "../components/CodeBlock";
import { ErrorMessage } from "../components/ErrorMessage";
import { Icon } from "../components/Icon";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { createWorkflow, toApiError, type ApiError } from "../services/api";
import { JOB_TYPE_LABELS, JOB_TYPES } from "../types/job";
import type { Edge, WorkflowDefinition } from "../types/workflow";
import { DAG_SMALL, layoutDag, type DagTask } from "../utils/dag";
import { JOB_TYPE_ICON } from "../utils/status";

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
const EXAMPLE_DEF = {
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
};
const EXAMPLE = JSON.stringify(EXAMPLE_DEF, null, 2);

const VALID_TYPES = new Set<string>(JOB_TYPES);
const LINE_HEIGHT = 20;

/**
 * Lightweight client-side validation so wrong `type`/`id`/`from`/`to` values get
 * a clear message before hitting the server (the server still does the full DAG
 * validation and checks option schemas).
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

type Parsed =
  | { ok: false; error: string; short: string }
  | {
      ok: true;
      def: WorkflowDefinition;
      tasks: DagTask[];
      deps: Edge[];
      /** Structural problem the preview can still draw around. */
      graphError: string | null;
      graphShort: string | null;
    };

function parseDefinition(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "Definition is not valid JSON. Check for missing commas or quotes.",
      short: "Invalid JSON",
    };
  }
  const problem = validateDefinition(raw);
  if (problem) return { ok: false, error: problem, short: problem };

  const def = raw as WorkflowDefinition;
  const deps = def.dependencies ?? [];
  const tasks = def.tasks.map((t): DagTask => ({ ref: t.id, type: t.type, status: "PENDING" }));
  const selfDep = deps.find((d) => d.from === d.to);

  let graphError: string | null = null;
  let graphShort: string | null = null;
  if (selfDep) {
    graphError = `Invalid workflow: task "${selfDep.from}" depends on itself.`;
    graphShort = "Self-dependency";
  } else if (layoutDag(tasks, deps, DAG_SMALL).cycle) {
    graphError = "Invalid workflow: the dependencies contain a cycle.";
    graphShort = "Cycle detected";
  }
  return { ok: true, def, tasks, deps, graphError, graphShort };
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="code-chip">{children}</code>;
}

export default function WorkflowCreate() {
  const navigate = useNavigate();
  const [text, setText] = useState(TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const parsed = useMemo(() => parseDefinition(text), [text]);
  const lineCount = text.split("\n").length;

  const validity = !parsed.ok
    ? { status: "FAILED", icon: "x", label: parsed.short }
    : parsed.graphShort
      ? { status: "CANCELLED", icon: "warning", label: parsed.graphShort }
      : { status: "SUCCESS", icon: "check", label: "Valid definition" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!parsed.ok) {
      setError({ message: parsed.error });
      return;
    }
    if (parsed.graphError) {
      setError({ message: parsed.graphError });
      return;
    }

    setSubmitting(true);
    try {
      // The server does the full DAG validation (cycles, refs, option schemas).
      const wf = await createWorkflow(parsed.def);
      navigate(`/workflows/${wf.id}`);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <Link to="/workflows" className="back-link">
        <Icon name="arrow-left" />
        Back to workflows
      </Link>

      <div className="rise" style={{ maxWidth: 720 }}>
        <div className="kicker kicker-line">Define a DAG</div>
        <h1 className="page-title" style={{ marginBottom: 12 }}>
          New workflow
        </h1>
        <p className="lede" style={{ lineHeight: 1.7 }}>
          Define the DAG as JSON: a list of <Code>tasks</Code> (each with an{" "}
          <Code>id</Code> and a <Code>type</Code>) and <Code>dependencies</Code>{" "}
          (<Code>from</Code> → <Code>to</Code>). The server rejects cycles, self-
          dependencies, and unknown references.
        </p>
      </div>

      <div className="split">
        <form onSubmit={handleSubmit} className="panel split-pane rise" style={{ animationDelay: ".08s" }}>
          <div className="pane-head">
            <label htmlFor="workflow-definition" className="label-sm">
              Workflow definition (JSON)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge badge-note st-${validity.status}`} title={validity.label}>
                <Icon name={validity.icon} weight="bold" />
                <span className="truncate">{validity.label}</span>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setText(EXAMPLE);
                  setError(null);
                }}
              >
                <Icon name="sparkle" />
                Load example
              </button>
            </div>
          </div>
          <div className={`editor${parsed.ok ? "" : " is-invalid"}`}>
            <div className="editor-gutter" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              id="workflow-definition"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              spellCheck={false}
              wrap="off"
              style={{ height: lineCount * LINE_HEIGHT + 22 }}
            />
          </div>
          {error && <ErrorMessage error={error} />}
          <div>
            <button type="submit" disabled={submitting} className="btn btn-primary btn-lg btn-glow">
              <Icon name={submitting ? "circle-notch" : "plus"} weight="bold" spin={submitting} />
              {submitting ? "Creating…" : "Create workflow"}
            </button>
          </div>
        </form>

        <div className="panel split-pane rise" style={{ animationDelay: ".14s" }}>
          <div className="pane-head" style={{ flexWrap: "nowrap" }}>
            <span className="label-sm">Live preview</span>
            {parsed.ok && (
              <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                {parsed.tasks.length} tasks · {parsed.deps.length} dependencies
              </span>
            )}
          </div>
          {parsed.ok ? (
            <WorkflowGraph tasks={parsed.tasks} dependencies={parsed.deps} preview />
          ) : (
            <div className="dag-empty">
              <div>
                <Icon name="graph" />
                Fix the definition to preview the DAG.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Reference: valid task types + a known-good example --- */}
      <div className="panel-quiet reference rise" style={{ animationDelay: ".2s" }}>
        <div>
          <h2>
            Valid task <code className="code-inline" style={{ fontSize: ".9em" }}>type</code> values
          </h2>
          <div className="type-chips">
            {JOB_TYPES.map((t) => (
              <span key={t} title={JOB_TYPE_LABELS[t]} className="type-chip">
                <Icon name={JOB_TYPE_ICON[t]} />
                {t}
              </span>
            ))}
          </div>
          <p>
            Per-task options go in an optional <code className="code-inline">payload</code> — e.g.{" "}
            <code className="code-inline">{'{"output_format": "xlsx"}'}</code> for FILE_CONVERSION, or{" "}
            <code className="code-inline">{'{"required_columns": ["id"], "id_column": "id"}'}</code> for
            BULK_DATA_VALIDATION.
          </p>
        </div>

        <div>
          <h2 style={{ marginBottom: 10 }}>Example</h2>
          <CodeBlock value={EXAMPLE_DEF} maxHeight={360} />
          <p style={{ marginTop: 8, lineHeight: "inherit" }}>
            Tip: common mistakes are using a comma vs. a period between fields,
            and a type that isn't in the list above. Use “Load example” to start
            from a valid definition.
          </p>
        </div>
      </div>
    </div>
  );
}
