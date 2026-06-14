"""DAG validation for workflow definitions.

Validates a set of task refs + dependency edges before a workflow is created:
  * every edge references existing tasks,
  * no self-dependencies,
  * no duplicate task refs,
  * no cycles (it must be a DAG).
"""


class DagValidationError(Exception):
    """Raised when a workflow definition is not a valid DAG."""


def validate_dag(task_refs: list[str], edges: list[tuple[str, str]]) -> None:
    """Validate task refs + (parent, child) edges. Raises DagValidationError."""
    if not task_refs:
        raise DagValidationError("A workflow must have at least one task.")

    seen = set()
    for ref in task_refs:
        if ref in seen:
            raise DagValidationError(f"Duplicate task id: {ref!r}")
        seen.add(ref)

    ref_set = set(task_refs)
    adjacency: dict[str, list[str]] = {ref: [] for ref in task_refs}

    for parent, child in edges:
        if parent == child:
            raise DagValidationError(f"Task {parent!r} cannot depend on itself.")
        if parent not in ref_set:
            raise DagValidationError(f"Dependency references unknown task: {parent!r}")
        if child not in ref_set:
            raise DagValidationError(f"Dependency references unknown task: {child!r}")
        adjacency[parent].append(child)

    _check_acyclic(task_refs, adjacency)


def _check_acyclic(nodes: list[str], adjacency: dict[str, list[str]]) -> None:
    """Detect cycles via DFS with a three-colour marking."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in nodes}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = GRAY
        for nxt in adjacency[node]:
            if color[nxt] == GRAY:
                cycle = " -> ".join(stack + [node, nxt])
                raise DagValidationError(f"Workflow has a cycle: {cycle}")
            if color[nxt] == WHITE:
                visit(nxt, stack + [node])
        color[node] = BLACK

    for n in nodes:
        if color[n] == WHITE:
            visit(n, [])
