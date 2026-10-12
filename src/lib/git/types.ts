export type GitFileStatus = "modified" | "added" | "deleted" | "untracked";

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
  /** workspacePath → decoration letter */
  decorations: Record<string, string>;
  error: string | null;
};

export type GitAuthor = {
  name: string;
  email: string;
};
