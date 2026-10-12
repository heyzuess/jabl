import type { GitCommitInfo } from "./types";

export type GraphLaneCommit = GitCommitInfo & {
  /** Column index for the commit node */
  column: number;
  /** Parent oids (may include ones outside the visible window) */
  parents: string[];
  isHead: boolean;
  isUpstream: boolean;
};

export type CommitGraphModel = {
  commits: GraphLaneCommit[];
  /** Max column index used */
  columns: number;
};

/**
 * Simple left-to-right lane assignment for a newest-first commit list.
 */
export function buildCommitGraph(
  commits: GitCommitInfo[],
  parentMap: Record<string, string[]>,
  opts: { headOid: string | null; upstreamOid: string | null }
): CommitGraphModel {
  const columnsForOid = new Map<string, number>();
  const freeColumns: number[] = [];
  let nextCol = 0;

  const alloc = (): number => {
    if (freeColumns.length) return freeColumns.shift()!;
    return nextCol++;
  };

  const result: GraphLaneCommit[] = [];

  for (const c of commits) {
    let col = columnsForOid.get(c.oid);
    if (col === undefined) {
      col = alloc();
      columnsForOid.set(c.oid, col);
    }

    const parents = parentMap[c.oid] ?? (c.parentOid ? [c.parentOid] : []);
    // First parent continues this lane; others get new lanes
    parents.forEach((p, idx) => {
      if (columnsForOid.has(p)) return;
      if (idx === 0) {
        columnsForOid.set(p, col!);
      } else {
        columnsForOid.set(p, alloc());
      }
    });

    // Free lane if no first parent in remaining list (lane ends)
    const first = parents[0];
    if (!first || !commits.some((x) => x.oid === first)) {
      // keep column reserved until we pass; free after assigning children seen
      freeColumns.push(col);
      freeColumns.sort((a, b) => a - b);
    }

    result.push({
      ...c,
      column: col,
      parents,
      isHead: opts.headOid === c.oid,
      isUpstream: opts.upstreamOid === c.oid,
    });
  }

  return { commits: result, columns: Math.max(1, nextCol) };
}
