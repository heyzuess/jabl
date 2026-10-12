import {
  Errors,
  TREE,
  STAGE,
  abortMerge as gitAbortMerge,
  add as gitAdd,
  addRemote as gitAddRemote,
  branch as gitBranch,
  checkout as gitCheckout,
  cherryPick as gitCherryPick,
  clone as gitClone,
  commit as gitCommit,
  currentBranch,
  deleteBranch as gitDeleteBranch,
  deleteRemote as gitDeleteRemote,
  deleteTag as gitDeleteTag,
  fetch as gitFetch,
  findMergeBase,
  getConfig,
  init as gitInit,
  listBranches,
  listFiles,
  listRemotes as gitListRemotes,
  listTags as gitListTags,
  log as gitLog,
  merge as gitMerge,
  push as gitPush,
  readBlob,
  readCommit,
  remove as gitRemove,
  resetIndex,
  resolveRef,
  setConfig,
  stash as gitStash,
  statusMatrix,
  tag as gitTag,
  updateIndex,
  walk,
  writeBlob,
  writeRef,
} from "isomorphic-git";
import type { FileNode } from "@/lib/workspace/types";
import {
  createFsAccessGitFs,
  hasGitDirectory,
  type BufferOverlay,
} from "./fs-access-git-fs";
import {
  applyLineChanges,
  hasConflictMarkers,
  resolveConflictMarkers,
  revertLineChanges,
  type ConflictResolveMode,
  type LineChange,
} from "./hunk-stage";
import {
  assertHttpsRemoteUrl,
  buildRemoteHttpOptions,
  formatRemoteError,
  type ProgressFn,
} from "./http";
import { getAppCorsProxy, setAppCorsProxy } from "./credentials";
import type {
  GitAheadBehind,
  GitAuthor,
  GitChange,
  GitCommitFileChange,
  GitCommitInfo,
  GitDiffSides,
  GitFileStatus,
  GitRemoteInfo,
  GitResetMode,
  GitStashEntry,
  GitStatusSnapshot,
  GitUpstreamInfo,
} from "./types";

const DIR = "/";

const emptySnapshot = (error: string | null = null): GitStatusSnapshot => ({
  available: false,
  branch: null,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: [],
  merging: false,
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
    case "conflict":
      return "C";
    default:
      return "M";
  }
}

async function gitFileExists(
  fs: ReturnType<typeof createFsAccessGitFs>,
  absPath: string
): Promise<boolean> {
  try {
    await fs.promises.stat(absPath);
    return true;
  } catch {
    return false;
  }
}

async function readGitTextFile(
  fs: ReturnType<typeof createFsAccessGitFs>,
  absPath: string
): Promise<string | null> {
  try {
    const raw = await fs.promises.readFile(absPath, { encoding: "utf8" });
    return typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  } catch {
    return null;
  }
}

async function isMergeInProgress(
  fs: ReturnType<typeof createFsAccessGitFs>
): Promise<boolean> {
  return gitFileExists(fs, "/.git/MERGE_HEAD");
}

async function ensureAuthorConfig(
  fs: ReturnType<typeof createFsAccessGitFs>,
  author: GitAuthor
): Promise<void> {
  const name = author.name.trim();
  const email = author.email.trim();
  if (!name || !email) {
    throw new Error("Author name and email are required");
  }
  await setConfig({ fs, dir: DIR, path: "user.name", value: name });
  await setConfig({ fs, dir: DIR, path: "user.email", value: email });
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
    const [matrix, branch, merging] = await Promise.all([
      statusMatrix({ fs, dir: DIR }),
      currentBranch({ fs, dir: DIR, fullname: false }),
      isMergeInProgress(fs),
    ]);

    const staged: GitChange[] = [];
    const unstaged: GitChange[] = [];
    const untracked: GitChange[] = [];
    const conflicts: GitChange[] = [];
    const decorations: Record<string, string> = {};
    const conflictPaths = new Set<string>();

    for (const [filepath, head, workdir, stage] of matrix) {
      const workspacePath = toWorkspacePath(ctx.rootName, filepath);
      const base = { filepath, workspacePath };

      // stage === 3 means unmerged / conflicted in isomorphic-git statusMatrix
      if (stage === 3) {
        conflictPaths.add(filepath);
        conflicts.push({ ...base, status: "conflict" });
        decorations[workspacePath] = "C";
        continue;
      }

      const { staged: s, unstaged: u, untracked: ut } = classifyRow(
        head,
        workdir,
        stage
      );

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
        decorations[workspacePath] = decorationLetter(u);
      } else if (s && !decorations[workspacePath]) {
        decorations[workspacePath] = decorationLetter(s);
      }
    }

    // During a merge, also surface files that still contain conflict markers
    // even if the index stage was cleared by a partial add.
    if (merging) {
      const candidates = [
        ...unstaged.map((c) => c.filepath),
        ...staged.map((c) => c.filepath),
      ];
      for (const filepath of candidates) {
        if (conflictPaths.has(filepath)) continue;
        const text = await readWorkdirText(ctx, filepath);
        if (!hasConflictMarkers(text)) continue;
        conflictPaths.add(filepath);
        const workspacePath = toWorkspacePath(ctx.rootName, filepath);
        conflicts.push({ filepath, workspacePath, status: "conflict" });
        decorations[workspacePath] = "C";
      }
    }

    return {
      available: true,
      branch: branch ?? "HEAD",
      staged: staged.filter((c) => !conflictPaths.has(c.filepath)),
      unstaged: unstaged.filter((c) => !conflictPaths.has(c.filepath)),
      untracked,
      conflicts,
      merging,
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

function decodeBlob(blob: Uint8Array | undefined | null): string {
  if (!blob || blob.byteLength === 0) return "";
  return new TextDecoder("utf-8", { fatal: false }).decode(blob);
}

async function readWorkdirText(
  ctx: GitContext,
  filepath: string
): Promise<string> {
  const { fs } = buildFs(ctx);
  const rel = filepath.replace(/^\/+/, "");
  try {
    const data = await fs.promises.readFile(`/${rel}`, { encoding: "utf8" });
    return typeof data === "string" ? data : decodeBlob(data);
  } catch {
    return "";
  }
}

export async function readFileAtRef(
  ctx: GitContext,
  filepath: string,
  ref: string
): Promise<string> {
  const { fs } = buildFs(ctx);
  const rel = filepath.replace(/^\/+/, "");
  try {
    const oid = await resolveRef({ fs, dir: DIR, ref });
    const { blob } = await readBlob({ fs, dir: DIR, oid, filepath: rel });
    return decodeBlob(blob);
  } catch {
    return "";
  }
}

async function readStagedText(
  ctx: GitContext,
  filepath: string
): Promise<string> {
  const { fs } = buildFs(ctx);
  const rel = filepath.replace(/^\/+/, "");
  try {
    const entries = await walk({
      fs,
      dir: DIR,
      trees: [STAGE()],
      map: async (fp, [stage]) => {
        if (fp !== rel) return undefined;
        if (!stage) return "";
        const content = await stage.content();
        return decodeBlob(content ?? null);
      },
    });
    const hit = (entries as Array<string | undefined>).find(
      (e) => typeof e === "string"
    );
    return hit ?? "";
  } catch {
    return "";
  }
}

export async function getWorkingDiffSides(
  ctx: GitContext,
  filepath: string
): Promise<GitDiffSides> {
  const rel = filepath.replace(/^\/+/, "");
  const [original, modified] = await Promise.all([
    readFileAtRef(ctx, rel, "HEAD"),
    readWorkdirText(ctx, rel),
  ]);
  return {
    original,
    modified,
    originalLabel: "HEAD",
    modifiedLabel: "Working Tree",
    filepath: rel,
    workspacePath: toWorkspacePath(ctx.rootName, rel),
  };
}

export async function getStagedDiffSides(
  ctx: GitContext,
  filepath: string
): Promise<GitDiffSides> {
  const rel = filepath.replace(/^\/+/, "");
  const [original, modified] = await Promise.all([
    readFileAtRef(ctx, rel, "HEAD"),
    readStagedText(ctx, rel),
  ]);
  return {
    original,
    modified,
    originalLabel: "HEAD",
    modifiedLabel: "Staged",
    filepath: rel,
    workspacePath: toWorkspacePath(ctx.rootName, rel),
  };
}

export async function getCommitFileDiff(
  ctx: GitContext,
  filepath: string,
  oid: string,
  parentOid: string | null
): Promise<GitDiffSides> {
  const rel = filepath.replace(/^\/+/, "");
  const original = parentOid
    ? await readFileAtRef(ctx, rel, parentOid)
    : "";
  const modified = await readFileAtRef(ctx, rel, oid);
  return {
    original,
    modified,
    originalLabel: parentOid ? parentOid.slice(0, 7) : "(empty)",
    modifiedLabel: oid.slice(0, 7),
    filepath: rel,
    workspacePath: toWorkspacePath(ctx.rootName, rel),
  };
}

export async function listCommitFiles(
  ctx: GitContext,
  oid: string,
  parentOid: string | null
): Promise<GitCommitFileChange[]> {
  const { fs } = buildFs(ctx);
  if (!parentOid) {
    // Root commit — every blob is an addition
    const files: GitCommitFileChange[] = [];
    await walk({
      fs,
      dir: DIR,
      trees: [TREE({ ref: oid })],
      map: async (filepath, [entry]) => {
        if (!filepath || filepath === ".") return;
        const type = entry ? await entry.type() : undefined;
        if (type === "blob") {
          files.push({ filepath, status: "added" });
        }
      },
    });
    return files.sort((a, b) => a.filepath.localeCompare(b.filepath));
  }

  const files: GitCommitFileChange[] = [];
  await walk({
    fs,
    dir: DIR,
    trees: [TREE({ ref: parentOid }), TREE({ ref: oid })],
    map: async (filepath, [a, b]) => {
      if (!filepath || filepath === ".") return;
      // Never call type()/oid() on a missing walker entry — ConstructEntry is
      // only created for paths present in that tree; the other side is null.
      const aType = a ? await a.type() : undefined;
      const bType = b ? await b.type() : undefined;

      // Descend into trees so adds/deletes inside new/removed dirs are listed.
      if (aType === "tree" || bType === "tree") {
        if (aType === "blob") {
          files.push({ filepath, status: "deleted" });
        } else if (bType === "blob") {
          files.push({ filepath, status: "added" });
        }
        return;
      }

      const aBlob = aType === "blob";
      const bBlob = bType === "blob";
      if (!aBlob && !bBlob) return;

      if (aBlob && !bBlob) {
        files.push({ filepath, status: "deleted" });
        return;
      }
      if (bBlob && !aBlob) {
        files.push({ filepath, status: "added" });
        return;
      }

      const aOid = await a!.oid();
      const bOid = await b!.oid();
      if (aOid !== bOid) {
        files.push({ filepath, status: "modified" });
      }
    },
  });
  return files.sort((a, b) => a.filepath.localeCompare(b.filepath));
}

export async function loadCommitLog(
  ctx: GitContext,
  depth = 50
): Promise<GitCommitInfo[]> {
  if (!(await probeGitRepo(ctx))) return [];
  const { fs } = buildFs(ctx);
  const commits = await gitLog({ fs, dir: DIR, depth });
  return commits.map((c) => {
    const message = c.commit.message || "";
    const subject = message.split("\n")[0] || "(no message)";
    return {
      oid: c.oid,
      shortOid: c.oid.slice(0, 7),
      message,
      subject,
      authorName: c.commit.author.name,
      authorEmail: c.commit.author.email,
      authorDate: c.commit.author.timestamp * 1000,
      parentOid: c.commit.parent[0] ?? null,
    };
  });
}

/**
 * Recursively list loose refs under a directory (e.g. refs/heads), returning
 * names relative to that prefix. Needed because branches like
 * `feature/foo` live in nested folders under `.git/refs/heads`.
 */
async function listLooseRefNames(
  fs: ReturnType<typeof createFsAccessGitFs>,
  absDir: string,
  prefix = ""
): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.promises.readdir(absDir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const childAbs = `${absDir.replace(/\/+$/, "")}/${name}`;
    const childName = prefix ? `${prefix}/${name}` : name;
    try {
      const st = await fs.promises.stat(childAbs);
      if (st.isDirectory()) {
        out.push(...(await listLooseRefNames(fs, childAbs, childName)));
      } else if (st.isFile()) {
        out.push(childName);
      }
    } catch {
      /* skip unreadable entries */
    }
  }
  return out;
}

async function listPackedHeadBranches(
  fs: ReturnType<typeof createFsAccessGitFs>
): Promise<string[]> {
  try {
    const raw = await fs.promises.readFile("/.git/packed-refs", {
      encoding: "utf8",
    });
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    const out: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const parts = line.trim().split(/\s+/);
      const ref = parts[1];
      if (ref?.startsWith("refs/heads/")) {
        out.push(ref.slice("refs/heads/".length));
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Create a new `.git` directory in the opened fs-access folder. */
export async function initRepository(
  ctx: GitContext,
  defaultBranch = "main"
): Promise<void> {
  if (ctx.mode !== "fs-access") {
    throw new Error(
      "Initialize Repository requires a folder opened with File System Access."
    );
  }
  const handle = rootHandleOf(ctx.root);
  if (!handle) throw new Error("No folder open.");
  if (await hasGitDirectory(handle)) {
    throw new Error("This folder already has a git repository.");
  }
  const { fs } = buildFs(ctx);
  await gitInit({ fs, dir: DIR, defaultBranch });
}

export async function listLocalBranches(ctx: GitContext): Promise<string[]> {
  if (!(await probeGitRepo(ctx))) return [];
  const { fs } = buildFs(ctx);
  const found = new Set<string>();

  // Prefer isomorphic-git, but it can yield [] when readdirDeep fails on FSA.
  try {
    for (const b of await listBranches({ fs, dir: DIR })) {
      if (b) found.add(b);
    }
  } catch {
    /* fall through to manual listing */
  }

  for (const b of await listLooseRefNames(fs, "/.git/refs/heads")) {
    found.add(b);
  }
  for (const b of await listPackedHeadBranches(fs)) {
    found.add(b);
  }

  // Always include the current branch name even if ref listing missed it.
  try {
    const current = await currentBranch({ fs, dir: DIR, fullname: false });
    if (current) found.add(current);
  } catch {
    /* ignore */
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

export async function checkoutBranch(
  ctx: GitContext,
  ref: string
): Promise<void> {
  const { fs } = buildFs(ctx);
  await gitCheckout({ fs, dir: DIR, ref });
}

export async function createBranch(
  ctx: GitContext,
  name: string,
  checkout = true
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Branch name is required");
  if (!/^[^\s~^:?*[\\]+$/.test(trimmed)) {
    throw new Error("Invalid branch name");
  }
  const { fs } = buildFs(ctx);
  await gitBranch({ fs, dir: DIR, ref: trimmed, checkout });
}

export async function deleteLocalBranch(
  ctx: GitContext,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Branch name is required");
  const current = await getCurrentBranch(ctx);
  if (current === trimmed) {
    throw new Error("Cannot delete the current branch");
  }
  const { fs } = buildFs(ctx);
  await gitDeleteBranch({ fs, dir: DIR, ref: trimmed });
}

export type MergeBranchResult =
  | { ok: true; kind: "already-merged" | "fast-forward" | "merged"; oid: string }
  | { ok: false; kind: "conflict"; filepaths: string[]; message: string };

export async function mergeBranch(
  ctx: GitContext,
  theirs: string,
  author: GitAuthor
): Promise<MergeBranchResult> {
  const trimmed = theirs.trim();
  if (!trimmed) throw new Error("Branch name is required");
  if (!author.name.trim() || !author.email.trim()) {
    throw new Error("Author name and email are required for merge commits");
  }
  const { fs } = buildFs(ctx);
  const ours = (await getCurrentBranch(ctx)) || "HEAD";
  try {
    const result = await gitMerge({
      fs,
      dir: DIR,
      ours,
      theirs: trimmed,
      // Leave conflict markers + MERGE_HEAD so the IDE can resolve in-place
      abortOnConflict: false,
      author: {
        name: author.name.trim(),
        email: author.email.trim(),
      },
    });
    if (result.alreadyMerged) {
      return { ok: true, kind: "already-merged", oid: "already-merged" };
    }
    // isomorphic-git fast-forward only moves the branch ref; checkout syncs
    // index + workdir (same as pull). Without this, the pre-merge tree stays
    // staged against the new HEAD.
    await gitCheckout({ fs, dir: DIR, ref: ours });
    if (result.fastForward) {
      return { ok: true, kind: "fast-forward", oid: result.oid ?? "fast-forward" };
    }
    return { ok: true, kind: "merged", oid: result.oid ?? "merged" };
  } catch (err) {
    if (isMergeConflictError(err)) {
      const filepaths =
        ((err as { data?: { filepaths?: string[] } }).data?.filepaths) ?? [];
      return {
        ok: false,
        kind: "conflict",
        filepaths,
        message:
          (err as Error).message ||
          `Merge conflicts in ${filepaths.length || "one or more"} file(s). Resolve them, then commit.`,
      };
    }
    throw err;
  }
}

function isMergeConflictError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if (err instanceof Errors.MergeConflictError) return true;
  return (err as { code?: string }).code === "MergeConflictError";
}

export async function abortMerge(ctx: GitContext): Promise<void> {
  const { fs } = buildFs(ctx);
  if (!(await isMergeInProgress(fs))) {
    throw new Error("No merge in progress");
  }
  await gitAbortMerge({ fs, dir: DIR });
}

/** Finish a conflicted merge after files are resolved and staged. */
export async function continueMerge(
  ctx: GitContext,
  message: string | undefined,
  author: GitAuthor
): Promise<string> {
  const { fs } = buildFs(ctx);
  if (!(await isMergeInProgress(fs))) {
    throw new Error("No merge in progress");
  }
  if (!author.name.trim() || !author.email.trim()) {
    throw new Error("Author name and email are required");
  }

  const snap = await loadGitStatus(ctx);
  if (snap.conflicts.length) {
    throw new Error(
      `Resolve conflicts first (${snap.conflicts.map((c) => c.filepath).join(", ")})`
    );
  }

  const mergeHeadRaw = await readGitTextFile(fs, "/.git/MERGE_HEAD");
  if (!mergeHeadRaw?.trim()) throw new Error("MERGE_HEAD missing");
  const theirsOid = mergeHeadRaw.trim().split(/\s+/)[0]!;
  const oursOid = await resolveRef({ fs, dir: DIR, ref: "HEAD" });

  let msg = (message ?? "").trim();
  if (!msg) {
    const mergeMsg = await readGitTextFile(fs, "/.git/MERGE_MSG");
    msg = mergeMsg?.trim() || "Merge commit";
  }

  // Stage any remaining resolved files that still differ from HEAD
  if (snap.unstaged.length || snap.untracked.length) {
    await stagePaths(ctx, [
      ...snap.unstaged.map((c) => c.filepath),
      ...snap.untracked.map((c) => c.filepath),
    ]);
  }

  const sha = await gitCommit({
    fs,
    dir: DIR,
    message: msg,
    author: {
      name: author.name.trim(),
      email: author.email.trim(),
    },
    parent: [oursOid, theirsOid],
  });

  // isomorphic-git commit does not always clear merge state
  for (const name of ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE", "ORIG_HEAD"]) {
    try {
      await fs.promises.unlink(`/.git/${name}`);
    } catch {
      /* ignore */
    }
  }
  return sha;
}

export async function resolveConflictFile(
  ctx: GitContext,
  filepath: string,
  mode: ConflictResolveMode
): Promise<void> {
  const rel = filepath.replace(/^\/+/, "");
  const { fs } = buildFs(ctx);
  const text = await readWorkdirText(ctx, rel);
  if (!hasConflictMarkers(text)) {
    throw new Error(`No conflict markers in ${rel}`);
  }
  const resolved = resolveConflictMarkers(text, mode);
  await fs.promises.writeFile(`/${rel}`, resolved);
  await gitAdd({ fs, dir: DIR, filepath: rel });
}

/** Write an arbitrary blob into the index (used for hunk/line staging). */
export async function writeIndexContent(
  ctx: GitContext,
  filepath: string,
  content: string
): Promise<void> {
  const rel = filepath.replace(/^\/+/, "");
  const { fs } = buildFs(ctx);
  if (content === "" && !(await gitFileExists(fs, `/${rel}`))) {
    // Staging a full-file deletion
    try {
      await gitRemove({ fs, dir: DIR, filepath: rel });
    } catch {
      await updateIndex({
        fs,
        dir: DIR,
        filepath: rel,
        remove: true,
        force: true,
      });
    }
    return;
  }
  const oid = await writeBlob({
    fs,
    dir: DIR,
    blob: new TextEncoder().encode(content),
  });
  await updateIndex({
    fs,
    dir: DIR,
    filepath: rel,
    oid,
    add: true,
  });
}

/**
 * Stage selected DiffEditor hunks from a working-tree diff (HEAD → workdir)
 * into the index without staging the whole file.
 */
export async function stageLineChanges(
  ctx: GitContext,
  filepath: string,
  changes: LineChange[]
): Promise<void> {
  if (!changes.length) return;
  const rel = filepath.replace(/^\/+/, "");
  const head = await readFileAtRef(ctx, rel, "HEAD");
  const work = await readWorkdirText(ctx, rel);
  // Preserve already-staged hunks: start from current index, then ensure
  // selected workdir hunks (relative to HEAD) are present by rebuilding from
  // HEAD + (index-vs-HEAD as baseline content when index differs).
  const staged = await readStagedText(ctx, rel);
  const base = staged !== "" || head === "" ? (staged || head) : head;
  // When index == HEAD (common), apply selected hunks onto HEAD.
  // When index already has content, apply selected hunks onto HEAD then take
  // union by applying onto current index only if index equals HEAD; otherwise
  // re-apply selected hunks onto HEAD and merge: prefer workdir for selected
  // regions via applyLineChanges(HEAD, work, changes) and keep other staged
  // by starting from index when index was built from HEAD+other hunks.
  let next: string;
  if (base === head) {
    next = applyLineChanges(head, work, changes);
  } else {
    // Index has other staged edits — apply selected hunks onto the index by
    // treating workdir as modified and mapping via HEAD-relative changes onto
    // a synthetic: take HEAD+selected, then overlay non-conflicting index lines
    // by using applyLineChanges(head, work, changes) which is the selected
    // subset, then for lines where index differs from head and wasn't in the
    // selected set, keep index — approximate by: start from index, replace
    // selected modified regions with workdir content using revert/apply dance.
    const withSelected = applyLineChanges(head, work, changes);
    // Prefer selected result where it differs from HEAD; elsewhere keep index
    next = mergePreferSelected(head, base, withSelected);
  }
  await writeIndexContent(ctx, rel, next);
}

/**
 * Unstage selected DiffEditor hunks from a staged diff (HEAD → index).
 */
export async function unstageLineChanges(
  ctx: GitContext,
  filepath: string,
  changes: LineChange[]
): Promise<void> {
  if (!changes.length) return;
  const rel = filepath.replace(/^\/+/, "");
  const head = await readFileAtRef(ctx, rel, "HEAD");
  const staged = await readStagedText(ctx, rel);
  const next = revertLineChanges(head, staged, changes);
  if (next === head) {
    await unstagePaths(ctx, [rel]);
    return;
  }
  await writeIndexContent(ctx, rel, next);
}

/** Line-wise: keep `selected` where it differs from `head`, else keep `index`. */
function mergePreferSelected(
  head: string,
  index: string,
  selected: string
): string {
  const h = head.split("\n");
  const idx = index.split("\n");
  const sel = selected.split("\n");
  const len = Math.max(h.length, idx.length, sel.length);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const hv = h[i];
    const iv = idx[i] ?? "";
    const sv = sel[i] ?? "";
    if (sv !== (hv ?? "")) out.push(sv);
    else out.push(iv);
  }
  // Trim trailing empties introduced by length padding when all sources shorter
  while (out.length > Math.max(idx.length, sel.length) && out[out.length - 1] === "") {
    out.pop();
  }
  return out.join("\n");
}

// --- Stash -----------------------------------------------------------------

export async function listStash(ctx: GitContext): Promise<GitStashEntry[]> {
  if (!(await probeGitRepo(ctx))) return [];
  const { fs } = buildFs(ctx);
  const raw = await gitStash({ fs, dir: DIR, op: "list" });
  if (!raw) return [];

  const normalize = (entry: unknown, index: number): GitStashEntry => {
    let message =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? String(
              (entry as { message?: string; msg?: string }).message ||
                (entry as { msg?: string }).msg ||
                entry
            )
          : String(entry);
    // isomorphic-git list returns `stash@{n}: …` — strip prefix for UI
    message = message.replace(/^stash@\{\d+\}:\s*/, "");
    return { index, message };
  };

  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(normalize);
  }
  if (typeof raw === "string") {
    return raw.split("\n").filter(Boolean).map(normalize);
  }
  return [];
}

export async function stashPush(
  ctx: GitContext,
  author: GitAuthor,
  opts?: { message?: string; includeUntracked?: boolean }
): Promise<void> {
  const { fs } = buildFs(ctx);
  await ensureAuthorConfig(fs, author);

  // isomorphic-git stash only includes tracked files; stage untracked first
  // so `-u` roughly matches `git stash -u`.
  if (opts?.includeUntracked) {
    const snap = await loadGitStatus(ctx);
    if (snap.untracked.length) {
      await stagePaths(
        ctx,
        snap.untracked.map((c) => c.filepath)
      );
    }
  }

  await gitStash({
    fs,
    dir: DIR,
    op: "push",
    message: opts?.message?.trim() || "",
  });
}

export async function stashPop(
  ctx: GitContext,
  refIdx = 0
): Promise<void> {
  const { fs } = buildFs(ctx);
  await gitStash({ fs, dir: DIR, op: "pop", refIdx });
}

export async function stashApply(
  ctx: GitContext,
  refIdx = 0
): Promise<void> {
  const { fs } = buildFs(ctx);
  await gitStash({ fs, dir: DIR, op: "apply", refIdx });
}

export async function stashDrop(
  ctx: GitContext,
  refIdx = 0
): Promise<void> {
  const { fs } = buildFs(ctx);
  await gitStash({ fs, dir: DIR, op: "drop", refIdx });
}

// --- History ops -----------------------------------------------------------

export async function revertCommit(
  ctx: GitContext,
  oid: string,
  author: GitAuthor
): Promise<string> {
  if (!author.name.trim() || !author.email.trim()) {
    throw new Error("Author name and email are required");
  }
  const { fs } = buildFs(ctx);
  const { commit } = await readCommit({ fs, dir: DIR, oid });
  if (commit.parent.length > 1) {
    throw new Error("Reverting merge commits is not supported");
  }
  const parentOid = commit.parent[0] ?? null;
  const files = await listCommitFiles(ctx, oid, parentOid);
  if (!files.length) throw new Error("Nothing to revert");

  for (const { filepath, status } of files) {
    const atCommit = await readFileAtRef(ctx, filepath, oid);
    const atHead = await readFileAtRef(ctx, filepath, "HEAD");
    const atParent = parentOid
      ? await readFileAtRef(ctx, filepath, parentOid)
      : "";

    // Safe file-level revert: only when HEAD still matches the commit version
    if (status !== "deleted" && atHead !== atCommit) {
      throw new Error(
        `Cannot revert ${filepath}: file changed since ${oid.slice(0, 7)}`
      );
    }
    if (status === "deleted" && atHead !== "") {
      throw new Error(
        `Cannot revert ${filepath}: file changed since ${oid.slice(0, 7)}`
      );
    }

    if (status === "added" || !parentOid || atParent === "") {
      // File was added by the commit — remove it
      try {
        await fs.promises.unlink(`/${filepath}`);
      } catch {
        /* already missing */
      }
      try {
        await gitRemove({ fs, dir: DIR, filepath });
      } catch {
        await updateIndex({
          fs,
          dir: DIR,
          filepath,
          remove: true,
          force: true,
        });
      }
    } else {
      await fs.promises.writeFile(`/${filepath}`, atParent);
      await gitAdd({ fs, dir: DIR, filepath });
    }
  }

  const subject = (commit.message || "").split("\n")[0] || oid.slice(0, 7);
  return gitCommit({
    fs,
    dir: DIR,
    message: `Revert "${subject}"\n\nThis reverts commit ${oid}.`,
    author: {
      name: author.name.trim(),
      email: author.email.trim(),
    },
  });
}

export async function cherryPickCommit(
  ctx: GitContext,
  oid: string,
  author: GitAuthor
): Promise<string> {
  if (!author.name.trim() || !author.email.trim()) {
    throw new Error("Author name and email are required");
  }
  const { fs } = buildFs(ctx);
  await ensureAuthorConfig(fs, author);
  try {
    return await gitCherryPick({
      fs,
      dir: DIR,
      oid,
      abortOnConflict: false,
      committer: {
        name: author.name.trim(),
        email: author.email.trim(),
      },
    });
  } catch (err) {
    if (isMergeConflictError(err)) {
      throw new Error(
        `Cherry-pick conflicts: resolve files, stage, and commit. ${(err as Error).message}`
      );
    }
    throw err;
  }
}

export async function resetToCommit(
  ctx: GitContext,
  oid: string,
  mode: GitResetMode
): Promise<void> {
  const { fs } = buildFs(ctx);
  const target = await resolveRef({ fs, dir: DIR, ref: oid });
  const branch = await currentBranch({ fs, dir: DIR, fullname: false });
  if (!branch) {
    throw new Error("Reset requires a checked-out branch (not detached HEAD)");
  }

  await writeRef({
    fs,
    dir: DIR,
    ref: `refs/heads/${branch}`,
    value: target,
    force: true,
  });

  if (mode === "soft") return;

  if (mode === "hard") {
    await gitCheckout({ fs, dir: DIR, ref: branch, force: true });
    return;
  }

  // mixed: align index to new HEAD; leave workdir alone
  const headFiles = new Set(await listFiles({ fs, dir: DIR, ref: "HEAD" }));
  let indexFiles: string[] = [];
  try {
    indexFiles = await listFiles({ fs, dir: DIR });
  } catch {
    indexFiles = [];
  }
  for (const filepath of indexFiles) {
    if (!headFiles.has(filepath)) {
      await updateIndex({
        fs,
        dir: DIR,
        filepath,
        remove: true,
        force: true,
      });
    }
  }
  for (const filepath of headFiles) {
    await resetIndex({ fs, dir: DIR, filepath });
  }
}

// --- Tags ------------------------------------------------------------------

export async function listLocalTags(ctx: GitContext): Promise<string[]> {
  if (!(await probeGitRepo(ctx))) return [];
  const { fs } = buildFs(ctx);
  const found = new Set<string>();
  try {
    for (const t of await gitListTags({ fs, dir: DIR })) {
      if (t) found.add(t);
    }
  } catch {
    /* fall through */
  }
  for (const t of await listLooseRefNames(fs, "/.git/refs/tags")) {
    found.add(t);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

export async function createTag(
  ctx: GitContext,
  name: string,
  object?: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");
  if (!/^[^\s~^:?*[\\]+$/.test(trimmed)) {
    throw new Error("Invalid tag name");
  }
  const { fs } = buildFs(ctx);
  await gitTag({
    fs,
    dir: DIR,
    ref: trimmed,
    object: object?.trim() || "HEAD",
  });
}

export async function deleteLocalTag(
  ctx: GitContext,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");
  const { fs } = buildFs(ctx);
  await gitDeleteTag({ fs, dir: DIR, ref: trimmed });
}

export async function checkoutRef(
  ctx: GitContext,
  ref: string
): Promise<void> {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error("Ref is required");
  const { fs } = buildFs(ctx);
  await gitCheckout({ fs, dir: DIR, ref: trimmed });
}

// --- Remotes / network -----------------------------------------------------

async function countCommitsUntil(
  fs: ReturnType<typeof createFsAccessGitFs>,
  startOid: string,
  stopOid: string,
  depth = 200
): Promise<number> {
  if (startOid === stopOid) return 0;
  const commits = await gitLog({ fs, dir: DIR, ref: startOid, depth });
  let n = 0;
  for (const c of commits) {
    if (c.oid === stopOid) break;
    n++;
  }
  return n;
}

export async function listRemotes(ctx: GitContext): Promise<GitRemoteInfo[]> {
  if (!(await probeGitRepo(ctx))) return [];
  const { fs } = buildFs(ctx);
  try {
    const remotes = await gitListRemotes({ fs, dir: DIR });
    return remotes.map((r) => ({ remote: r.remote, url: r.url }));
  } catch {
    return [];
  }
}

export async function addRemote(
  ctx: GitContext,
  remote: string,
  url: string
): Promise<void> {
  const name = remote.trim();
  if (!name) throw new Error("Remote name is required");
  if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
    throw new Error("Invalid remote name");
  }
  const httpsUrl = assertHttpsRemoteUrl(url);
  const { fs } = buildFs(ctx);
  await gitAddRemote({ fs, dir: DIR, remote: name, url: httpsUrl });
}

export async function removeRemote(
  ctx: GitContext,
  remote: string
): Promise<void> {
  const name = remote.trim();
  if (!name) throw new Error("Remote name is required");
  const { fs } = buildFs(ctx);
  await gitDeleteRemote({ fs, dir: DIR, remote: name });
}

export async function getCorsProxySetting(ctx: GitContext): Promise<string> {
  if (await probeGitRepo(ctx)) {
    try {
      const { fs } = buildFs(ctx);
      const fromRepo = await getConfig({
        fs,
        dir: DIR,
        path: "http.corsProxy",
      });
      if (typeof fromRepo === "string" && fromRepo.trim()) {
        return fromRepo.trim();
      }
    } catch {
      /* fall through */
    }
  }
  return getAppCorsProxy();
}

export async function setCorsProxySetting(
  ctx: GitContext,
  proxy: string
): Promise<void> {
  const value = proxy.trim();
  setAppCorsProxy(value);
  if (await probeGitRepo(ctx)) {
    const { fs } = buildFs(ctx);
    await setConfig({
      fs,
      dir: DIR,
      path: "http.corsProxy",
      value,
    });
  }
}

export async function getUpstreamInfo(
  ctx: GitContext
): Promise<GitUpstreamInfo | null> {
  if (!(await probeGitRepo(ctx))) return null;
  const { fs } = buildFs(ctx);
  const branch = await currentBranch({ fs, dir: DIR, fullname: false });
  if (!branch) return null;
  const remote =
    ((await getConfig({
      fs,
      dir: DIR,
      path: `branch.${branch}.remote`,
    })) as string | undefined) || null;
  const merge =
    ((await getConfig({
      fs,
      dir: DIR,
      path: `branch.${branch}.merge`,
    })) as string | undefined) || null;
  if (!remote || !merge) return null;
  const remoteBranch = merge.replace(/^refs\/heads\//, "");
  const trackingRef = `refs/remotes/${remote}/${remoteBranch}`;
  try {
    await resolveRef({ fs, dir: DIR, ref: trackingRef });
  } catch {
    // Upstream configured but tracking ref missing (not fetched yet)
    return { remote, remoteBranch, trackingRef };
  }
  return { remote, remoteBranch, trackingRef };
}

export async function getAheadBehind(
  ctx: GitContext
): Promise<GitAheadBehind> {
  const upstream = await getUpstreamInfo(ctx);
  if (!upstream) return { ahead: 0, behind: 0, upstream: null };
  const { fs } = buildFs(ctx);
  let localOid: string;
  let remoteOid: string;
  try {
    localOid = await resolveRef({ fs, dir: DIR, ref: "HEAD" });
    remoteOid = await resolveRef({ fs, dir: DIR, ref: upstream.trackingRef });
  } catch {
    return { ahead: 0, behind: 0, upstream };
  }
  if (localOid === remoteOid) {
    return { ahead: 0, behind: 0, upstream };
  }
  try {
    const bases = await findMergeBase({
      fs,
      dir: DIR,
      oids: [localOid, remoteOid],
    });
    const base = bases[0];
    if (!base) {
      return { ahead: 0, behind: 0, upstream };
    }
    const [ahead, behind] = await Promise.all([
      countCommitsUntil(fs, localOid, base),
      countCommitsUntil(fs, remoteOid, base),
    ]);
    return { ahead, behind, upstream };
  } catch {
    return { ahead: 0, behind: 0, upstream };
  }
}

async function setUpstreamTracking(
  fs: ReturnType<typeof createFsAccessGitFs>,
  branch: string,
  remote: string,
  remoteBranch: string
): Promise<void> {
  await setConfig({
    fs,
    dir: DIR,
    path: `branch.${branch}.remote`,
    value: remote,
  });
  await setConfig({
    fs,
    dir: DIR,
    path: `branch.${branch}.merge`,
    value: `refs/heads/${remoteBranch}`,
  });
}

export async function fetchRemote(
  ctx: GitContext,
  remote = "origin",
  onProgress?: ProgressFn
): Promise<void> {
  const { fs } = buildFs(ctx);
  const httpOpts = buildRemoteHttpOptions({ onProgress });
  try {
    await gitFetch({
      fs,
      dir: DIR,
      remote: remote.trim() || "origin",
      ...httpOpts,
    });
  } catch (err) {
    throw new Error(formatRemoteError(err));
  }
}

export async function pullRemote(
  ctx: GitContext,
  author: GitAuthor,
  remote?: string,
  onProgress?: ProgressFn
): Promise<void> {
  const { fs } = buildFs(ctx);
  await ensureAuthorConfig(fs, author);
  const upstream = await getUpstreamInfo(ctx);
  const remoteName = remote?.trim() || upstream?.remote || "origin";
  const branch = await currentBranch({ fs, dir: DIR, fullname: false });
  if (!branch) throw new Error("Detached HEAD — check out a branch to pull");

  try {
    await gitFetch({
      fs,
      dir: DIR,
      remote: remoteName,
      ...buildRemoteHttpOptions({ onProgress }),
    });
  } catch (err) {
    throw new Error(formatRemoteError(err));
  }

  const remoteBranch = upstream?.remoteBranch || branch;
  const theirs = `refs/remotes/${remoteName}/${remoteBranch}`;
  try {
    await resolveRef({ fs, dir: DIR, ref: theirs });
  } catch {
    throw new Error(
      `No remote-tracking branch ${remoteName}/${remoteBranch}. Fetch or publish first.`
    );
  }

  // Merge with abortOnConflict:false so Phase B conflict UI can resolve
  const merged = await mergeBranch(ctx, theirs, author);
  if (!merged.ok) {
    throw new Error(merged.message);
  }
}

export async function pushBranch(
  ctx: GitContext,
  opts?: {
    remote?: string;
    setUpstream?: boolean;
    onProgress?: ProgressFn;
  }
): Promise<void> {
  const { fs } = buildFs(ctx);
  const branch = await currentBranch({ fs, dir: DIR, fullname: false });
  if (!branch) throw new Error("Detached HEAD — check out a branch to push");
  const upstream = await getUpstreamInfo(ctx);
  const remote = opts?.remote?.trim() || upstream?.remote || "origin";
  const remoteRef = upstream?.remoteBranch || branch;
  const httpOpts = buildRemoteHttpOptions({ onProgress: opts?.onProgress });
  try {
    await gitPush({
      fs,
      dir: DIR,
      remote,
      ref: branch,
      remoteRef,
      ...httpOpts,
    });
  } catch (err) {
    throw new Error(formatRemoteError(err));
  }
  if (opts?.setUpstream || !upstream) {
    await setUpstreamTracking(fs, branch, remote, remoteRef);
  }
}

export async function publishBranch(
  ctx: GitContext,
  remote = "origin",
  onProgress?: ProgressFn
): Promise<void> {
  await pushBranch(ctx, {
    remote: remote.trim() || "origin",
    setUpstream: true,
    onProgress,
  });
}

export async function syncWithRemote(
  ctx: GitContext,
  author: GitAuthor,
  onProgress?: ProgressFn
): Promise<"pulled" | "pushed" | "uptodate" | "diverged"> {
  const upstream = await getUpstreamInfo(ctx);
  if (!upstream) {
    await publishBranch(ctx, "origin", onProgress);
    return "pushed";
  }
  await fetchRemote(ctx, upstream.remote, onProgress);
  const ab = await getAheadBehind(ctx);
  if (ab.ahead === 0 && ab.behind === 0) return "uptodate";
  if (ab.behind > 0 && ab.ahead === 0) {
    await pullRemote(ctx, author, upstream.remote, onProgress);
    return "pulled";
  }
  if (ab.ahead > 0 && ab.behind === 0) {
    await pushBranch(ctx, { remote: upstream.remote, onProgress });
    return "pushed";
  }
  // Diverged — pull first (may conflict), caller can push after
  await pullRemote(ctx, author, upstream.remote, onProgress);
  return "diverged";
}

/**
 * Clone into an empty File System Access directory handle.
 * Caller should open the folder as the workspace afterward.
 */
export async function cloneRepository(
  handle: FileSystemDirectoryHandle,
  url: string,
  onProgress?: ProgressFn
): Promise<void> {
  const httpsUrl = assertHttpsRemoteUrl(url);
  const fs = createFsAccessGitFs(handle, null);
  // Refuse non-empty targets (other than ignored junk)
  const entries = (await fs.promises.readdir("/")) as string[];
  const names = entries.filter((n: string) => n && n !== "." && n !== "..");
  if (names.length > 0) {
    throw new Error(
      "Clone target folder is not empty. Pick an empty directory."
    );
  }
  const httpOpts = buildRemoteHttpOptions({ onProgress });
  try {
    await gitClone({
      fs,
      dir: DIR,
      url: httpsUrl,
      singleBranch: false,
      ...httpOpts,
    });
  } catch (err) {
    throw new Error(formatRemoteError(err));
  }
}
