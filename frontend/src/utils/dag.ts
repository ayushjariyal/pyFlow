// Layered left-to-right DAG layout: column = longest path from a root, rows are
// centred vertically within each column.

import type { Edge, TaskStatus } from "../types/workflow";

export interface DagSize {
  W: number;
  H: number;
  CG: number; // column gap
  RG: number; // row gap
  P: number; // canvas padding
  pad: string;
  fs: string;
  fs2: string;
}

export const DAG_LARGE: DagSize = { W: 188, H: 66, CG: 92, RG: 18, P: 18, pad: "0 12px", fs: "14px", fs2: "10.5px" };
export const DAG_SMALL: DagSize = { W: 140, H: 50, CG: 50, RG: 12, P: 12, pad: "0 10px", fs: "12.5px", fs2: "9.5px" };

export interface DagTask {
  ref: string;
  type: string;
  status: TaskStatus;
}

export interface DagNode extends DagTask {
  x: number;
  y: number;
  level: number;
  row: number;
  hasIn: boolean;
  hasOut: boolean;
}

export interface DagEdge {
  key: string;
  d: string;
  len: number;
  level: number;
  /** Parent succeeded and the child is about to run / running. */
  active: boolean;
  done: boolean;
  dim: boolean;
}

export interface DagLayout {
  width: number;
  height: number;
  nodes: DagNode[];
  edges: DagEdge[];
  /** True when the dependencies contain a cycle (some tasks never resolve). */
  cycle: boolean;
}

export function layoutDag(tasks: DagTask[], deps: Edge[], c: DagSize): DagLayout {
  const refs = tasks.map((t) => t.ref);
  const children = new Map<string, string[]>(refs.map((r) => [r, []]));
  const indeg = new Map<string, number>(refs.map((r) => [r, 0]));
  const level = new Map<string, number>(refs.map((r) => [r, 0]));

  const valid = deps.filter((e) => children.has(e.from) && indeg.has(e.to));
  valid.forEach((e) => {
    children.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  });

  const queue = refs.filter((r) => indeg.get(r) === 0);
  let seen = 0;
  while (queue.length) {
    const n = queue.shift()!;
    seen++;
    for (const child of children.get(n)!) {
      level.set(child, Math.max(level.get(child)!, level.get(n)! + 1));
      indeg.set(child, indeg.get(child)! - 1);
      if (indeg.get(child) === 0) queue.push(child);
    }
  }

  const perLevel = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number; level: number; row: number }>();
  refs.forEach((r) => {
    const lv = level.get(r)!;
    const row = perLevel.get(lv) ?? 0;
    perLevel.set(lv, row + 1);
    pos.set(r, { x: c.P + lv * (c.W + c.CG), y: 0, level: lv, row });
  });

  const maxLevel = Math.max(0, ...refs.map((r) => level.get(r)!));
  const maxRows = Math.max(1, ...perLevel.values());
  const totalH = maxRows * c.H + (maxRows - 1) * c.RG;
  pos.forEach((p) => {
    const n = perLevel.get(p.level)!;
    const colH = n * c.H + (n - 1) * c.RG;
    p.y = c.P + (totalH - colH) / 2 + p.row * (c.H + c.RG);
  });

  const byRef = new Map(tasks.map((t) => [t.ref, t]));
  const hasIn = new Set<string>();
  const hasOut = new Set<string>();
  const edges = valid.map((e, i): DagEdge => {
    hasOut.add(e.from);
    hasIn.add(e.to);
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    const x1 = a.x + c.W;
    const y1 = a.y + c.H / 2;
    const x2 = b.x;
    const y2 = b.y + c.H / 2;
    const dx = Math.max(24, (x2 - x1) / 2);
    const from = byRef.get(e.from)!.status;
    const to = byRef.get(e.to)!.status;
    return {
      key: `${e.from}>${e.to}#${i}`,
      d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      len: Math.round(Math.hypot(x2 - x1, y2 - y1) * 1.12 + 4),
      level: a.level,
      active: from === "SUCCESS" && (to === "READY" || to === "RUNNING"),
      done: from === "SUCCESS" && to === "SUCCESS",
      dim: to === "SKIPPED" || from === "FAILED",
    };
  });

  const nodes = tasks.map((t): DagNode => {
    const p = pos.get(t.ref)!;
    return { ...t, ...p, hasIn: hasIn.has(t.ref), hasOut: hasOut.has(t.ref) };
  });

  return {
    width: c.P * 2 + (maxLevel + 1) * c.W + maxLevel * c.CG,
    height: c.P * 2 + totalH,
    nodes,
    edges,
    cycle: seen < refs.length,
  };
}
