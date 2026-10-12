export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "untracked"
  | "conflict";

export type GitChange = {
  /** Path relative to the repo root (posix, no leading slash) */
  filepath: string;
  /** Workspace path including root folder name */
  workspacePath: string;
  status: GitFileStatus;
};

export type GitStatusSnapshot = {
  available: boolean;
  branch: string | null;
  staged: GitChange[];
  unstaged: GitChange[];
  untracked: GitChange[];
  /** Files with unresolved merge conflict markers / unmerged index */
  conflicts: GitChange[];
  /** True when `.git/MERGE_HEAD` is present */
  merging: boolean;
  /** workspacePath → decoration letter */
  decorations: Record<string, string>;
  error: string | null;
};

export type GitAuthor = {
  name: string;
  email: string;
};

export type GitCommitInfo = {
  oid: string;
  shortOid: string;
  message: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authorDate: number;
  parentOid: string | null;
};

/** File change between two commits (or commit vs parent). */
export type GitCommitFileChange = {
  filepath: string;
  status: "added" | "deleted" | "modified";
};

export type GitDiffSides = {
  original: string;
  modified: string;
  originalLabel: string;
  modifiedLabel: string;
  workspacePath: string;
  filepath: string;
};

export type GitStashEntry = {
  index: number;
  message: string;
};

export type GitResetMode = "soft" | "mixed" | "hard";
