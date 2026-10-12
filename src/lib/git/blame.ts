import type { GitCommitInfo } from "./types";

export type BlameLine = {
  line: number; // 1-based
  oid: string;
  shortOid: string;
  parentOid: string | null;
  authorName: string;
  authorDate: number;
  subject: string;
};

/**
 * Attribute each line of `currentText` to the newest commit that introduced it,
 * walking filepath history from newest → oldest.
 */
export function blameLinesFromHistory(
  currentText: string,
  history: Array<{
    commit: GitCommitInfo;
    textAtCommit: string;
    textAtParent: string;
  }>
): BlameLine[] {
  const lines = splitLines(currentText);
  const blamed: Array<BlameLine | null> = lines.map(() => null);

  for (const entry of history) {
    const introduced = linesIntroduced(entry.textAtParent, entry.textAtCommit);
    if (!introduced.size) continue;
    const atCommit = splitLines(entry.textAtCommit);
    for (let i = 0; i < lines.length; i++) {
      if (blamed[i]) continue;
      const content = lines[i]!;
      // Match by content against introduced lines still present in current file
      for (const lineNo of introduced) {
        const hist = atCommit[lineNo - 1];
        if (hist === content) {
          blamed[i] = {
            line: i + 1,
            oid: entry.commit.oid,
            shortOid: entry.commit.shortOid,
            parentOid: entry.commit.parentOid,
            authorName: entry.commit.authorName,
            authorDate: entry.commit.authorDate,
            subject: entry.commit.subject,
          };
          introduced.delete(lineNo);
          break;
        }
      }
    }
  }

  // Remaining lines → oldest commit in history, or placeholder
  const fallback = history[history.length - 1]?.commit ?? null;
  return lines.map((_, i) => {
    if (blamed[i]) return blamed[i]!;
    if (fallback) {
      return {
        line: i + 1,
        oid: fallback.oid,
        shortOid: fallback.shortOid,
        parentOid: fallback.parentOid,
        authorName: fallback.authorName,
        authorDate: fallback.authorDate,
        subject: fallback.subject,
      };
    }
    return {
      line: i + 1,
      oid: "",
      shortOid: "-------",
      parentOid: null,
      authorName: "?",
      authorDate: 0,
      subject: "untracked",
    };
  });
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const parts = text.split("\n");
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** 1-based line numbers in `after` that are not in `before` (LCS-ish hunk adds). */
function linesIntroduced(before: string, after: string): Set<number> {
  const a = splitLines(before);
  const b = splitLines(after);
  const introduced = new Set<number>();
  // Myers-lite: scan with two pointers
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    // Prefer treating as addition when after has more remaining
    if (
      j < b.length &&
      (i >= a.length ||
        (j + 1 < b.length && a[i] === b[j + 1]) ||
        b.length - j > a.length - i)
    ) {
      introduced.add(j + 1);
      j++;
      continue;
    }
    if (i < a.length) {
      i++;
      continue;
    }
    introduced.add(j + 1);
    j++;
  }
  return introduced;
}
