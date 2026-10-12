/** Monaco-compatible line change (1-based; end 0 means empty side). */
export type LineChange = {
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
};

function splitLines(text: string): string[] {
  if (text === "") return [];
  const parts = text.split("\n");
  // Preserve trailing newline as empty last element only when text ends with \n
  if (text.endsWith("\n")) return parts;
  return parts;
}

function joinLines(lines: string[]): string {
  if (lines.length === 0) return "";
  return lines.join("\n");
}

/**
 * Apply a set of original→modified line changes onto `base` (typically the
 * original / HEAD side), producing content with only those hunks applied.
 * Hunks are applied from bottom to top so line numbers stay valid.
 */
export function applyLineChanges(
  original: string,
  modified: string,
  changes: LineChange[]
): string {
  if (!changes.length) return original;
  const origLines = splitLines(original);
  const modLines = splitLines(modified);
  const sorted = [...changes].sort(
    (a, b) => b.originalStartLineNumber - a.originalStartLineNumber
  );

  let lines = [...origLines];
  for (const c of sorted) {
    const origStart = c.originalStartLineNumber;
    const origEnd = c.originalEndLineNumber;
    const modStart = c.modifiedStartLineNumber;
    const modEnd = c.modifiedEndLineNumber;

    const before =
      origStart <= 0 ? 0 : Math.max(0, origStart - 1);
    const deleteCount =
      origEnd === 0 || origStart === 0
        ? 0
        : Math.max(0, origEnd - origStart + 1);

    const insert =
      modEnd === 0 || modStart === 0
        ? []
        : modLines.slice(modStart - 1, modEnd);

    // Insertion at end-of-file / after a line: Monaco uses originalEnd=0
    // with originalStart pointing at the line after which to insert.
    if (origEnd === 0 && origStart > 0) {
      const at = origStart; // insert after this 1-based line
      lines = [...lines.slice(0, at), ...insert, ...lines.slice(at)];
    } else {
      lines = [
        ...lines.slice(0, before),
        ...insert,
        ...lines.slice(before + deleteCount),
      ];
    }
  }
  return joinLines(lines);
}

/**
 * Remove selected changes from `modified` by restoring the corresponding
 * original slices (used to unstage hunks from an index that equals `modified`
 * relative to HEAD/`original`).
 */
export function revertLineChanges(
  original: string,
  modified: string,
  changes: LineChange[]
): string {
  if (!changes.length) return modified;
  const origLines = splitLines(original);
  const modLines = splitLines(modified);
  const sorted = [...changes].sort(
    (a, b) => b.modifiedStartLineNumber - a.modifiedStartLineNumber
  );

  let lines = [...modLines];
  for (const c of sorted) {
    const origStart = c.originalStartLineNumber;
    const origEnd = c.originalEndLineNumber;
    const modStart = c.modifiedStartLineNumber;
    const modEnd = c.modifiedEndLineNumber;

    const before = modStart <= 0 ? 0 : Math.max(0, modStart - 1);
    const deleteCount =
      modEnd === 0 || modStart === 0
        ? 0
        : Math.max(0, modEnd - modStart + 1);

    const insert =
      origEnd === 0 || origStart === 0
        ? []
        : origLines.slice(origStart - 1, origEnd);

    if (modEnd === 0 && modStart > 0) {
      const at = modStart;
      lines = [...lines.slice(0, at), ...insert, ...lines.slice(at)];
    } else {
      lines = [
        ...lines.slice(0, before),
        ...insert,
        ...lines.slice(before + deleteCount),
      ];
    }
  }
  return joinLines(lines);
}

/** Pick the change containing the cursor (1-based line on modified side). */
export function changeAtModifiedLine(
  changes: LineChange[],
  line: number
): LineChange | null {
  for (const c of changes) {
    if (c.modifiedEndLineNumber === 0) {
      // Pure deletion — associate with surrounding line
      if (c.modifiedStartLineNumber === line || c.modifiedStartLineNumber + 1 === line) {
        return c;
      }
      continue;
    }
    if (
      line >= c.modifiedStartLineNumber &&
      line <= c.modifiedEndLineNumber
    ) {
      return c;
    }
  }
  return null;
}

/** Changes that intersect a modified-side selection (1-based inclusive). */
export function changesIntersectingSelection(
  changes: LineChange[],
  startLine: number,
  endLine: number
): LineChange[] {
  const lo = Math.min(startLine, endLine);
  const hi = Math.max(startLine, endLine);
  return changes.filter((c) => {
    if (c.modifiedEndLineNumber === 0) {
      return c.modifiedStartLineNumber >= lo - 1 && c.modifiedStartLineNumber <= hi;
    }
    return !(c.modifiedEndLineNumber < lo || c.modifiedStartLineNumber > hi);
  });
}

const CONFLICT_OURS = /^<<<<<<</;
const CONFLICT_BASE = /^\|\|\|\|\|\|\|/;
const CONFLICT_MID = /^=======/;
const CONFLICT_THEIRS = /^>>>>>>>/;

export type ConflictResolveMode = "current" | "incoming" | "both";

/** Resolve standard conflict-marker blocks in a file. */
export function resolveConflictMarkers(
  text: string,
  mode: ConflictResolveMode
): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!CONFLICT_OURS.test(lines[i]!)) {
      out.push(lines[i]!);
      i++;
      continue;
    }
    i++; // skip <<<<<<<
    const ours: string[] = [];
    while (
      i < lines.length &&
      !CONFLICT_MID.test(lines[i]!) &&
      !CONFLICT_BASE.test(lines[i]!)
    ) {
      ours.push(lines[i]!);
      i++;
    }
    if (i < lines.length && CONFLICT_BASE.test(lines[i]!)) {
      i++; // skip |||||||
      while (i < lines.length && !CONFLICT_MID.test(lines[i]!)) i++;
    }
    if (i < lines.length && CONFLICT_MID.test(lines[i]!)) i++; // skip =======
    const theirs: string[] = [];
    while (i < lines.length && !CONFLICT_THEIRS.test(lines[i]!)) {
      theirs.push(lines[i]!);
      i++;
    }
    if (i < lines.length && CONFLICT_THEIRS.test(lines[i]!)) i++; // skip >>>>>>>

    if (mode === "current") out.push(...ours);
    else if (mode === "incoming") out.push(...theirs);
    else out.push(...ours, ...theirs);
  }
  return out.join("\n");
}

export function hasConflictMarkers(text: string): boolean {
  return CONFLICT_OURS.test(text) && CONFLICT_MID.test(text);
}
