import type { Edge, TaskStatus, WorkflowTask } from "../types/workflow";

// Status -> colours (gray pending, blue running, green success, red failed).
const COLORS: Record<TaskStatus, { fill: string; stroke: string; text: string }> = {
  PENDING: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
  READY: { fill: "#dbeafe", stroke: "#60a5fa", text: "#1e40af" },
  RUNNING: { fill: "#bfdbfe", stroke: "#3b82f6", text: "#1e3a8a" },
  SUCCESS: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  FAILED: { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b" },
  SKIPPED: { fill: "#f8fafc", stroke: "#cbd5e1", text: "#94a3b8" },
};

const NODE_W = 150;
const NODE_H = 52;
const COL_GAP = 70;
const ROW_GAP = 24;
const PAD = 16;

/** Assign each node a column = longest path from a root (topological levels). */
function computeLevels(refs: string[], edges: Edge[]): Map<string, number> {
  const children = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  refs.forEach((r) => {
    children.set(r, []);
    indeg.set(r, 0);
  });
  edges.forEach((e) => {
    children.get(e.from)?.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });

  const level = new Map<string, number>(refs.map((r) => [r, 0]));
  const queue = refs.filter((r) => (indeg.get(r) ?? 0) === 0);
  while (queue.length) {
    const n = queue.shift()!;
    for (const c of children.get(n) ?? []) {
      level.set(c, Math.max(level.get(c) ?? 0, (level.get(n) ?? 0) + 1));
      indeg.set(c, (indeg.get(c) ?? 0) - 1);
      if ((indeg.get(c) ?? 0) === 0) queue.push(c);
    }
  }
  return level;
}

export function WorkflowGraph({
  tasks,
  dependencies,
}: {
  tasks: WorkflowTask[];
  dependencies: Edge[];
}) {
  const refs = tasks.map((t) => t.ref);
  const level = computeLevels(refs, dependencies);

  // Position: x by level (column), y by index within the level (row).
  const perLevel = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  refs.forEach((ref) => {
    const lv = level.get(ref) ?? 0;
    const row = perLevel.get(lv) ?? 0;
    perLevel.set(lv, row + 1);
    pos.set(ref, {
      x: PAD + lv * (NODE_W + COL_GAP),
      y: PAD + row * (NODE_H + ROW_GAP),
    });
  });

  const maxLevel = Math.max(0, ...refs.map((r) => level.get(r) ?? 0));
  const maxRows = Math.max(1, ...[...perLevel.values()]);
  const width = PAD * 2 + (maxLevel + 1) * NODE_W + maxLevel * COL_GAP;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
      <svg width={width} height={height} className="min-w-full">
        {/* edges */}
        {dependencies.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x + NODE_W}
              y1={a.y + NODE_H / 2}
              x2={b.x}
              y2={b.y + NODE_H / 2}
              stroke="#94a3b8"
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />
          );
        })}
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* nodes */}
        {tasks.map((t) => {
          const p = pos.get(t.ref);
          if (!p) return null;
          const c = COLORS[t.status];
          return (
            <g key={t.id}>
              <rect
                x={p.x}
                y={p.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={2}
              />
              <text
                x={p.x + NODE_W / 2}
                y={p.y + 20}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill={c.text}
              >
                {t.ref}
              </text>
              <text
                x={p.x + NODE_W / 2}
                y={p.y + 38}
                textAnchor="middle"
                fontSize="10"
                fill={c.text}
              >
                {t.task_type} · {t.status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
