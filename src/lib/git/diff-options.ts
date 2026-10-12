export type GitDiffOptions = {
  renderSideBySide: boolean;
  ignoreWhitespace: boolean;
  wordWrap: boolean;
};

const KEY = "jabl.git.diffOptions";

const defaults: GitDiffOptions = {
  renderSideBySide: true,
  ignoreWhitespace: false,
  wordWrap: false,
};

export function loadDiffOptions(): GitDiffOptions {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<GitDiffOptions>;
    return {
      renderSideBySide:
        typeof parsed.renderSideBySide === "boolean"
          ? parsed.renderSideBySide
          : defaults.renderSideBySide,
      ignoreWhitespace:
        typeof parsed.ignoreWhitespace === "boolean"
          ? parsed.ignoreWhitespace
          : defaults.ignoreWhitespace,
      wordWrap:
        typeof parsed.wordWrap === "boolean"
          ? parsed.wordWrap
          : defaults.wordWrap,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveDiffOptions(opts: GitDiffOptions): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    /* ignore */
  }
}
