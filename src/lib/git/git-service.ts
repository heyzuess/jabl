import {
  add as gitAdd,
  commit as gitCommit,
  currentBranch,
  remove as gitRemove,
  resetIndex,
  statusMatrix,
} from "isomorphic-git";
import type { FileNode } from "@/lib/workspace/types";
import {
  createFsAccessGitFs,
  hasGitDirectory,
  type BufferOverlay,
} from "./fs-access-git-fs";
import type { GitAuthor, GitChange, GitFileStatus, GitStatusSnapshot } from "./types";

const DIR = "/";

const emptySnapshot = (error: string | null = null): GitStatusSnapshot => ({
  available: false,
  branch: null,
  staged: [],
  unstaged: [],
  untracked: [],
  decorations: {},
  error,
});

function rootHandleOf(root: FileNode | null): FileSystemDirectoryHandle | null {
  if (!root || root.kind !== "directory" || !root.handle) return null;
  return root.handle as FileSystemDirectoryHandle;
}

function toWorkspacePath(rootName: string, filepath: string): string {
  const rel = filepath.replace(/^\/+/, "");
  return rel ? `${rootName}/${rel}` : rootName;
}

function classifyRow(
  head: number,
  workdir: number,
  stage: number
): {
  staged: GitFileStatus | null;
  unstaged: GitFileStatus | null;
  untracked: boolean;
} {
  // Untracked
  if (head === 0 && stage === 0 && workdir === 2) {
    return { staged: null, unstaged: null, untracked: true };
  }

  let staged: GitFileStatus | null = null;
  if (stage !== head) {
    if (head === 0 && stage > 0) staged = "added";
    else if (stage === 0 && head === 1) staged = "deleted";
    else staged = "modified";
  }

  let unstaged: GitFileStatus | null = null;
  if (workdir !== stage) {
    if (workdir === 0) unstaged = "deleted";
    else if (head === 0 && stage === 0) unstaged = "untracked";
    else unstaged = "modified";
  }

  return { staged, unstaged, untracked: false };
}

function decorationLetter(status: GitFileStatus): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "U";
    default:
      return "M";
  }
}

export type GitContext = {
  mode: string;
  root: FileNode | null;
  rootName: string;
  buffers: Record<string, string>;
  dirty: Record<string, boolean>;
};

function buildFs(ctx: GitContext) {
  const handle = rootHandleOf(ctx.root);
  if (!handle) throw new Error("No writable folder open");
  const overlay: BufferOverlay = {
    rootName: ctx.rootName,
    getBuffer: (wp) => ctx.buffers[wp],
    isDirty: (wp) => !!ctx.dirty[wp],
  };
  return { fs: createFsAccessGitFs(handle, overlay), handle };
}

export async function probeGitRepo(ctx: GitContext): Promise<boolean> {
  if (ctx.mode !== "fs-access") return false;
  const handle = rootHandleOf(ctx.root);
  if (!handle) return false;
  return hasGitDirectory(handle);
}

export async function loadGitStatus(ctx: GitContext): Promise<GitStatusSnapshot> {
  if (ctx.mode !== "fs-access") {
    return emptySnapshot("Open a local folder with File System Access to use Source Control.");
  }
  const handle = rootHandleOf(ctx.root);
  if (!handle) {
    return emptySnapshot("No folder open.");
  }
  if (!(await hasGitDirectory(handle))) {
    return emptySnapshot("No git repository found in this folder (.git missing).");
  }

  try {
    const { fs } = buildFs(ctx);
    const [matrix, branch] = await Promise.all([
      statusMatrix({ fs, dir: DIR }),
      currentBranch({ fs, dir: DIR, fullname: false }),
    ]);

    const staged: GitChange[] = [];
    const unstaged: GitChange[] = [];
    const untracked: GitChange[] = [];
    const decorations: Record<string, string> = {};

    for (const [filepath, head, workdir, stage] of matrix) {
      const { staged: s, unstaged: u, untracked: ut } = classifyRow(
        head,
        workdir,
        stage
      );
      const workspacePath = toWorkspacePath(ctx.rootName, filepath);
      const base = { filepath, workspacePath };

      if (ut) {
        untracked.push({ ...base, status: "untracked" });
        decorations[workspacePath] = "U";
        continue;
      }
      if (s) {
        staged.push({ ...base, status: s });
        decorations[workspacePath] = decorationLetter(s);
      }
      if (u && u !== "untracked") {
        unstaged.push({ ...base, status: u });
        // Prefer unstaged letter when both (M over staged A, etc.)
        decorations[workspacePath] = decorationLetter(u);
      } else if (s && !decorations[workspacePath]) {
        decorations[workspacePath] = decorationLetter(s);
      }
    }

    return {
      available: true,
      branch: branch ?? "HEAD",
      staged,
      unstaged,
      untracked,
      decorations,
      error: null,
    };
  } catch (err) {
    return emptySnapshot(`Git error: ${(err as Error).message}`);
  }
}

export async function stagePaths(
  ctx: GitContext,
  filepaths: string[]
): Promise<void> {
  const { fs } = buildFs(ctx);
  for (const filepath of filepaths) {
    const rel = filepath.replace(/^\/+/, "");
    try {
      await gitAdd({ fs, dir: DIR, filepath: rel });
    } catch {
      // Deleted from workdir — stage the removal
      await gitRemove({ fs, dir: DIR, filepath: rel });
    }
  }
}

export async function unstagePaths(
  ctx: GitContext,
  filepaths: string[]
): Promise<void> {
  const { fs } = buildFs(ctx);
  for (const filepath of filepaths) {
    const rel = filepath.replace(/^\/+/, "");
    await resetIndex({ fs, dir: DIR, filepath: rel });
  }
}

export async function stageAll(ctx: GitContext): Promise<number> {
  const snap = await loadGitStatus(ctx);
  const paths = [
    ...snap.unstaged.map((c) => c.filepath),
    ...snap.untracked.map((c) => c.filepath),
  ];
  if (paths.length) await stagePaths(ctx, paths);
  return paths.length;
}

export async function unstageAll(ctx: GitContext): Promise<number> {
  const snap = await loadGitStatus(ctx);
  const paths = snap.staged.map((c) => c.filepath);
  if (paths.length) await unstagePaths(ctx, paths);
  return paths.length;
}

export async function commitStaged(
  ctx: GitContext,
  message: string,
  author: GitAuthor
): Promise<string> {
  const msg = message.trim();
  if (!msg) throw new Error("Commit message is required");
  if (!author.name.trim() || !author.email.trim()) {
    throw new Error("Author name and email are required");
  }
  const { fs } = buildFs(ctx);
  const snap = await loadGitStatus(ctx);
  if (!snap.staged.length) throw new Error("Nothing staged to commit");

  const sha = await gitCommit({
    fs,
    dir: DIR,
    message: msg,
    author: {
      name: author.name.trim(),
      email: author.email.trim(),
    },
  });
  return sha;
}

export async function getCurrentBranch(ctx: GitContext): Promise<string | null> {
  if (!(await probeGitRepo(ctx))) return null;
  const { fs } = buildFs(ctx);
  const branch = await currentBranch({ fs, dir: DIR, fullname: false });
  return branch ?? "HEAD";
}

/** Resolve a terminal/workspace path argument to a repo-relative filepath. */
export function toRepoRelativePath(
  pathArg: string,
  rootName: string,
  cwd: string
): string {
  let p = pathArg.trim().replace(/\\/g, "/");
  if (p === "." || p === "./") return ".";
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/")) p = p.slice(1);

  // Absolute-ish workspace path: rootName/...
  if (p === rootName) return ".";
  if (p.startsWith(`${rootName}/`)) {
    return p.slice(rootName.length + 1);
  }

  // Relative to cwd
  const cwdRel =
    cwd === rootName || !cwd.startsWith(rootName)
      ? ""
      : cwd.slice(rootName.length + 1);
  if (!cwdRel) return p;
  return `${cwdRel}/${p}`.replace(/\/+/g, "/");
}
