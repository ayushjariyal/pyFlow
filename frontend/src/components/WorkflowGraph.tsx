import { useMemo } from "react";
import type { Edge } from "../types/workflow";
import { DAG_LARGE, DAG_SMALL, layoutDag, type DagTask } from "../utils/dag";
import { STATUS_ICON } from "../utils/status";
import { Icon } from "./Icon";
import { ProgressBar } from "./ProgressBar";

/**
 * Left-to-right DAG. The full variant colours nodes by task status and animates
 * edges feeding a ready/running task; `preview` is the compact, status-less
 * variant used while editing a definition.
 */
export function WorkflowGraph({
  tasks,
  dependencies,
  preview = false,
}: {
  tasks: DagTask[];
  dependencies: Edge[];
  preview?: boolean;
}) {
  const size = preview ? DAG_SMALL : DAG_LARGE;
  const dag = useMemo(() => layoutDag(tasks, dependencies, size), [tasks, dependencies, size]);
  const base = preview ? 0 : 0.1;
  const flowing = preview ? [] : dag.edges.filter((e) => e.active);

  return (
    <div className={`dag-canvas${preview ? " is-preview" : ""}`}>
      <div className="dag-stage" style={{ width: dag.width, height: dag.height }}>
        <svg width={dag.width} height={dag.height}>
          {dag.edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              className={`dag-edge${preview ? "" : e.done ? " is-done" : e.active ? " is-active" : e.dim ? " is-dim" : ""}`}
              style={{
                strokeDasharray: e.len,
                ["--len" as string]: e.len,
                animationDelay: `${(base + 0.2 + e.level * 0.2).toFixed(2)}s`,
              }}
            />
          ))}
          {flowing.map((e) => (
            <path key={e.key} d={e.d} className="dag-edge-flow" />
          ))}
        </svg>
        {flowing.map((e) => (
          <div key={e.key} className="dag-pulse" style={{ offsetPath: `path('${e.d}')` }} />
        ))}
        {dag.nodes.map((n) => (
          <div
            key={n.ref}
            className={`dag-node st-${n.status}`}
            style={{
              left: n.x,
              top: n.y,
              width: size.W,
              height: size.H,
              animationDelay: `${(base + n.level * 0.2 + n.row * 0.06).toFixed(2)}s`,
            }}
          >
            <div
              className="dag-node-body"
              title={preview ? `${n.ref} · ${n.type}` : `${n.ref} · ${n.type} · ${n.status}`}
              style={{ padding: size.pad }}
            >
              {preview ? (
                <span className="dag-node-ref" style={{ fontSize: size.fs }}>
                  {n.ref}
                </span>
              ) : (
                <div className="dag-node-top">
                  <span className="dag-node-ref" style={{ fontSize: size.fs }}>
                    {n.ref}
                  </span>
                  <span className="dag-node-icon">
                    <Icon name={STATUS_ICON[n.status]} weight="bold" spin={n.status === "RUNNING"} />
                  </span>
                </div>
              )}
              <span className="dag-node-type" style={{ fontSize: size.fs2 }}>
                {n.type}
              </span>
              {!preview && n.status === "RUNNING" && (
                <ProgressBar value={null} className="dag-node-progress" />
              )}
            </div>
            {!preview && n.hasIn && <span className="dag-port dag-port-in" />}
            {!preview && n.hasOut && <span className="dag-port dag-port-out" />}
          </div>
        ))}
      </div>
    </div>
  );
}
