"use client";

import { create } from "zustand";
import { useWorkspaceStore } from "@/lib/workspace/store";
import type {
  GitAheadBehind,
  GitAuthor,
  GitChange,
  GitCommitFileChange,
  GitCommitInfo,
  GitRemoteInfo,
  GitResetMode,
  GitStashEntry,
  GitStatusSnapshot,
} from "./types";
import type { LineChange } from "./hunk-stage";
import type { ConflictResolveMode } from "./hunk-stage";
import {
  abortMerge as abortMergeSvc,
  addRemote as addRemoteSvc,
  addToGitignore as addToGitignoreSvc,
  blameFile as blameFileSvc,
  checkoutBranch as checkoutBranchSvc,
  checkoutRef as checkoutRefSvc,
  cherryPickCommit as cherryPickSvc,
  cloneRepository as cloneRepositorySvc,
  commitStaged,
  continueMerge as continueMergeSvc,
  createBranch as createBranchSvc,
  createTag as createTagSvc,
  deleteLocalBranch as deleteBranchSvc,
  deleteLocalTag as deleteTagSvc,
  discardWorkingPaths as discardWorkingPathsSvc,
  fetchRemote as fetchRemoteSvc,
  getAheadBehind as getAheadBehindSvc,
  getCommitFileDiff,
  getCorsProxySetting as getCorsProxySettingSvc,
  getStagedDiffSides,
  getWorkingDiffSides,
  initRepository,
  listCommitFiles,
  listLocalBranches,
  listLocalTags,
  listRemotes as listRemotesSvc,
  listStash,
  loadCommitGraph as loadCommitGraphSvc,
  loadCommitLog,
  loadFileCommitLog as loadFileCommitLogSvc,
  loadGitStatus,
  mergeBranch as mergeBranchSvc,
  publishBranch as publishBranchSvc,
  pullRemote as pullRemoteSvc,
  pushBranch as pushBranchSvc,
  removeRemote as removeRemoteSvc,
  resetToCommit as resetToCommitSvc,
  resolveConflictFile as resolveConflictFileSvc,
  revertCommit as revertCommitSvc,
  setCorsProxySetting as setCorsProxySettingSvc,
  stageAll,
  stageLineChanges as stageLineChangesSvc,
  stagePaths,
  stashApply as stashApplySvc,
  stashDrop as stashDropSvc,
  stashPop as stashPopSvc,
  stashPush as stashPushSvc,
  syncWithRemote as syncWithRemoteSvc,
  undoLastCommit as undoLastCommitSvc,
  unstageAll,
  unstageLineChanges as unstageLineChangesSvc,
  unstagePaths,
  type BlameLine,
  type CommitGraphModel,
  type GitContext,
} from "./git-service";
import { clearAllStoredCredentials } from "./credentials";
import {
  setAuthPromptHandler,
  type AuthPromptResult,
} from "./http";
import {
  loadDiffOptions,
  saveDiffOptions,
  type GitDiffOptions,
} from "./diff-options";

const AUTHOR_KEY = "jabl-git-author";

function loadAuthor(): GitAuthor {
  if (typeof window === "undefined") return { name: "", email: "" };
  try {
    const raw = localStorage.getItem(AUTHOR_KEY);
    if (!raw) return { name: "", email: "" };
    const parsed = JSON.parse(raw) as Partial<GitAuthor>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
    };
  } catch {
    return { name: "", email: "" };
  }
}

function persistAuthor(author: GitAuthor) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTHOR_KEY, JSON.stringify(author));
  } catch {
    /* ignore */
  }
}

function ctxFromWorkspace(): GitContext {
  const s = useWorkspaceStore.getState();
  return {
    mode: s.mode,
    root: s.root,
    rootName: s.rootName,
    buffers: s.buffers,
    dirty: s.dirty,
  };
}

async function reloadTreeAfterCheckout() {
  await useWorkspaceStore.getState().reloadFsAccessTree();
}

function authorOf(get: () => GitState): GitAuthor {
  return { name: get().authorName, email: get().authorEmail };
}

type GitState = GitStatusSnapshot & {
  busy: boolean;
  authorName: string;
  authorEmail: string;
  commitMessage: string;
  branches: string[];
  tags: string[];
  commits: GitCommitInfo[];
  stashes: GitStashEntry[];
  /** Changed files keyed by commit oid (vs first parent) */
  commitFiles: Record<string, GitCommitFileChange[]>;
  expandedCommitOid: string | null;
  /** First commit chosen for two-commit compare (left / original side) */
  compareBaseOid: string | null;
  /** Active compare result: base → head file list */
  compareResult: {
    baseOid: string;
    headOid: string;
    files: GitCommitFileChange[];
  } | null;
  remotes: GitRemoteInfo[];
  aheadBehind: GitAheadBehind;
  corsProxy: string;
  progress: string | null;
  authPrompt: {
    url: string;
    host: string;
    reason: "needed" | "rejected";
  } | null;
  setAuthorName: (name: string) => void;
  setAuthorEmail: (email: string) => void;
  setCommitMessage: (message: string) => void;
  refresh: () => Promise<void>;
  submitAuthPrompt: (result: AuthPromptResult) => void;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;
  setCorsProxy: (proxy: string) => Promise<void>;
  clearSavedCredentials: () => void;
  fetchRemote: (remote?: string) => Promise<void>;
  pullRemote: (remote?: string) => Promise<void>;
  pushBranch: (opts?: { remote?: string; setUpstream?: boolean }) => Promise<void>;
  publishBranch: (remote?: string) => Promise<void>;
  syncRemote: () => Promise<void>;
  cloneRepository: (url: string) => Promise<void>;
  stage: (filepaths: string[]) => Promise<void>;
  unstage: (filepaths: string[]) => Promise<void>;
  stageAllChanges: () => Promise<void>;
  unstageAllChanges: () => Promise<void>;
  reset: () => void;
  loadHistory: () => Promise<void>;
  expandCommit: (oid: string | null) => Promise<void>;
  selectForCompare: (oid: string) => void;
  clearCompare: () => void;
  compareWithSelected: (oid: string) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  createBranch: (name: string, checkout?: boolean) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  mergeBranch: (name: string) => Promise<void>;
  abortMerge: () => Promise<void>;
  continueMerge: (message?: string) => Promise<void>;
  resolveConflict: (
    filepath: string,
    mode: ConflictResolveMode
  ) => Promise<void>;
  initRepo: (defaultBranch?: string) => Promise<void>;
  openWorkingDiff: (filepath: string) => Promise<void>;
  openStagedDiff: (filepath: string) => Promise<void>;
  openCommitDiff: (
    filepath: string,
    oid: string,
    parentOid: string | null
  ) => Promise<void>;
  openCompareDiff: (
    filepath: string,
    baseOid: string,
    headOid: string
  ) => Promise<void>;
  stashPush: (opts?: {
    message?: string;
    includeUntracked?: boolean;
  }) => Promise<void>;
  stashPop: (refIdx?: number) => Promise<void>;
  stashApply: (refIdx?: number) => Promise<void>;
  stashDrop: (refIdx?: number) => Promise<void>;
  revertCommit: (oid: string) => Promise<void>;
  cherryPick: (oid: string) => Promise<void>;
  resetToCommit: (oid: string, mode: GitResetMode) => Promise<void>;
  createTag: (name: string, object?: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  checkoutTag: (name: string) => Promise<void>;
  stageHunks: (filepath: string, changes: LineChange[]) => Promise<void>;
  unstageHunks: (filepath: string, changes: LineChange[]) => Promise<void>;
  discardChanges: (
    filepaths: string[],
    opts?: { untracked?: boolean }
  ) => Promise<void>;
  addToGitignore: (pattern: string) => Promise<void>;
  /** Smart commit: stage-all when nothing staged (unless amend). */
  commit: (message?: string, opts?: { amend?: boolean }) => Promise<string>;
  undoLastCommit: () => Promise<void>;
  diffOptions: GitDiffOptions;
  setDiffOptions: (opts: Partial<GitDiffOptions>) => void;
  fileTimeline: GitCommitInfo[];
  loadFileTimeline: (filepath: string) => Promise<void>;
  blameEnabled: boolean;
  setBlameEnabled: (on: boolean) => void;
  blameLines: BlameLine[];
  blamePath: string | null;
  loadBlame: (filepath: string) => Promise<void>;
  commitGraph: CommitGraphModel;
  loadCommitGraph: () => Promise<void>;
};

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshSeq = 0;
let authPromptResolve: ((result: AuthPromptResult) => void) | null = null;

const emptyAheadBehind: GitAheadBehind = {
  ahead: 0,
  behind: 0,
  upstream: null,
};

function onNetworkProgress(set: (partial: Partial<GitState>) => void) {
  return (e: { phase: string; loaded: number; total: number }) => {
    const total = e.total > 0 ? ` ${e.loaded}/${e.total}` : "";
    set({ progress: `${e.phase}${total}` });
  };
}

export const useGitStore = create<GitState>((set, get) => {
  const author = loadAuthor();
  return {
    available: false,
    branch: null,
    staged: [] as GitChange[],
    unstaged: [] as GitChange[],
    untracked: [] as GitChange[],
    conflicts: [] as GitChange[],
    merging: false,
    decorations: {},
    error: null,
    busy: false,
    authorName: author.name,
    authorEmail: author.email,
    commitMessage: "",
    branches: [],
    tags: [],
    commits: [],
    stashes: [],
    commitFiles: {},
    expandedCommitOid: null,
    compareBaseOid: null,
    compareResult: null,
    remotes: [],
    aheadBehind: emptyAheadBehind,
    corsProxy: "",
    progress: null,
    authPrompt: null,
    diffOptions: loadDiffOptions(),
    fileTimeline: [],
    blameEnabled: false,
    blameLines: [],
    blamePath: null,
    commitGraph: { commits: [], columns: 1 },

    setAuthorName: (name) => {
      set({ authorName: name });
      persistAuthor({ name, email: get().authorEmail });
    },

    setAuthorEmail: (email) => {
      set({ authorEmail: email });
      persistAuthor({ name: get().authorName, email });
    },

    setCommitMessage: (message) => set({ commitMessage: message }),

    submitAuthPrompt: (result) => {
      authPromptResolve?.(result);
      authPromptResolve = null;
      set({ authPrompt: null });
    },

    reset: () =>
      set({
        available: false,
        branch: null,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
        merging: false,
        decorations: {},
        error: null,
        busy: false,
        branches: [],
        tags: [],
        commits: [],
        stashes: [],
        commitFiles: {},
        expandedCommitOid: null,
        compareBaseOid: null,
        compareResult: null,
        remotes: [],
        aheadBehind: emptyAheadBehind,
        progress: null,
        authPrompt: null,
        fileTimeline: [],
        blameLines: [],
        blamePath: null,
        commitGraph: { commits: [], columns: 1 },
      }),

    refresh: async () => {
      const seq = ++refreshSeq;
      set({ busy: true });
      const ctx = ctxFromWorkspace();
      const snap = await loadGitStatus(ctx);
      if (seq !== refreshSeq) return;

      let branches = get().branches;
      let tags = get().tags;
      let commits = get().commits;
      let stashes = get().stashes;
      let remotes = get().remotes;
      let aheadBehind = get().aheadBehind;
      let corsProxy = get().corsProxy;
      try {
        corsProxy = await getCorsProxySettingSvc(ctx);
      } catch {
        /* keep */
      }
      if (snap.available) {
        try {
          branches = await listLocalBranches(ctx);
        } catch (err) {
          console.warn("[git] listLocalBranches failed", err);
          if (snap.branch && !branches.includes(snap.branch)) {
            branches = [...branches, snap.branch].sort((a, b) =>
              a.localeCompare(b)
            );
          }
        }
        try {
          tags = await listLocalTags(ctx);
        } catch (err) {
          console.warn("[git] listLocalTags failed", err);
        }
        try {
          commits = await loadCommitLog(ctx, 50);
        } catch (err) {
          console.warn("[git] loadCommitLog failed", err);
        }
        try {
          stashes = await listStash(ctx);
        } catch (err) {
          console.warn("[git] listStash failed", err);
          stashes = [];
        }
        try {
          remotes = await listRemotesSvc(ctx);
        } catch (err) {
          console.warn("[git] listRemotes failed", err);
          remotes = [];
        }
        try {
          aheadBehind = await getAheadBehindSvc(ctx);
        } catch (err) {
          console.warn("[git] getAheadBehind failed", err);
          aheadBehind = emptyAheadBehind;
        }
      } else {
        branches = [];
        tags = [];
        commits = [];
        stashes = [];
        remotes = [];
        aheadBehind = emptyAheadBehind;
      }

      if (seq !== refreshSeq) return;
      set({
        ...snap,
        branches,
        tags,
        commits,
        stashes,
        remotes,
        aheadBehind,
        corsProxy,
        busy: false,
      });
      if (snap.available) {
        void get().loadCommitGraph();
      }
    },

    loadHistory: async () => {
      const ctx = ctxFromWorkspace();
      try {
        const commits = await loadCommitLog(ctx, 50);
        set({ commits });
      } catch (err) {
        set({ error: (err as Error).message });
      }
    },

    expandCommit: async (oid) => {
      if (!oid) {
        set({ expandedCommitOid: null });
        return;
      }
      if (get().expandedCommitOid === oid) {
        set({ expandedCommitOid: null });
        return;
      }
      set({ expandedCommitOid: oid, busy: true, error: null });
      try {
        if (!get().commitFiles[oid]) {
          const commit = get().commits.find((c) => c.oid === oid);
          const files = await listCommitFiles(
            ctxFromWorkspace(),
            oid,
            commit?.parentOid ?? null
          );
          set({
            commitFiles: { ...get().commitFiles, [oid]: files },
          });
        }
        set({ busy: false });
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    selectForCompare: (oid) => {
      set({
        compareBaseOid: oid,
        compareResult: null,
        error: null,
      });
      useWorkspaceStore
        .getState()
        .setStatus(`Selected ${oid.slice(0, 7)} for compare`);
    },

    clearCompare: () => {
      set({ compareBaseOid: null, compareResult: null, error: null });
    },

    compareWithSelected: async (oid) => {
      const baseOid = get().compareBaseOid;
      if (!baseOid) {
        set({ error: "Select a commit for compare first" });
        return;
      }
      if (baseOid === oid) {
        set({ error: "Choose a different commit to compare" });
        return;
      }
      set({ busy: true, error: null });
      try {
        const files = await listCommitFiles(ctxFromWorkspace(), oid, baseOid);
        set({
          busy: false,
          compareResult: { baseOid, headOid: oid, files },
        });
        useWorkspaceStore.getState().setStatus(
          `Compare ${baseOid.slice(0, 7)} → ${oid.slice(0, 7)} (${files.length} file${files.length === 1 ? "" : "s"})`
        );
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    stage: async (filepaths) => {
      if (!filepaths.length) return;
      set({ busy: true, error: null });
      try {
        await stagePaths(ctxFromWorkspace(), filepaths);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    unstage: async (filepaths) => {
      if (!filepaths.length) return;
      set({ busy: true, error: null });
      try {
        await unstagePaths(ctxFromWorkspace(), filepaths);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    stageAllChanges: async () => {
      set({ busy: true, error: null });
      try {
        await stageAll(ctxFromWorkspace());
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    unstageAllChanges: async () => {
      set({ busy: true, error: null });
      try {
        await unstageAll(ctxFromWorkspace());
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
      }
    },

    commit: async (message, opts) => {
      const msg = (message ?? get().commitMessage).trim();
      set({ busy: true, error: null });
      try {
        if (get().merging) {
          const sha = await continueMergeSvc(
            ctxFromWorkspace(),
            msg || undefined,
            authorOf(get)
          );
          set({ commitMessage: "" });
          await reloadTreeAfterCheckout();
          await get().refresh();
          return sha;
        }
        // Smart commit: nothing staged → confirm then stage all
        if (!opts?.amend && get().staged.length === 0) {
          const pending =
            get().unstaged.length + get().untracked.length;
          if (pending === 0) throw new Error("Nothing to commit");
          const ok = window.confirm(
            `No staged changes. Stage all ${pending} file(s) and commit?`
          );
          if (!ok) {
            set({ busy: false });
            throw new Error("Commit cancelled");
          }
          await stageAll(ctxFromWorkspace());
          await get().refresh();
        }
        if (opts?.amend) {
          const ab = get().aheadBehind;
          if (ab.upstream && ab.ahead === 0) {
            const ok = window.confirm(
              "Amend will rewrite a commit that may already be on the remote. Continue?"
            );
            if (!ok) {
              set({ busy: false });
              throw new Error("Amend cancelled");
            }
          }
        }
        const sha = await commitStaged(
          ctxFromWorkspace(),
          msg,
          authorOf(get),
          { amend: !!opts?.amend }
        );
        set({ commitMessage: "" });
        await get().refresh();
        void get().loadCommitGraph();
        return sha;
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    undoLastCommit: async () => {
      set({ busy: true, error: null });
      try {
        await undoLastCommitSvc(ctxFromWorkspace());
        await get().refresh();
        void get().loadCommitGraph();
        useWorkspaceStore.getState().setStatus("Undid last commit (soft)");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    discardChanges: async (filepaths, opts) => {
      if (!filepaths.length) return;
      set({ busy: true, error: null });
      try {
        await discardWorkingPathsSvc(ctxFromWorkspace(), filepaths, opts);
        // Clear dirty buffers for discarded workspace paths
        const rootName = useWorkspaceStore.getState().rootName;
        const ws = useWorkspaceStore.getState();
        for (const fp of filepaths) {
          const wp = rootName ? `${rootName}/${fp}` : fp;
          if (ws.buffers[wp] != null) {
            // reload from disk via clearing dirty and buffer; refresh tree later
            useWorkspaceStore.setState((s) => {
              const dirty = { ...s.dirty };
              delete dirty[wp];
              return { dirty };
            });
          }
        }
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Discarded changes");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    addToGitignore: async (pattern) => {
      set({ busy: true, error: null });
      try {
        await addToGitignoreSvc(ctxFromWorkspace(), pattern);
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Added to .gitignore: ${pattern}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    setDiffOptions: (partial) => {
      const next = { ...get().diffOptions, ...partial };
      saveDiffOptions(next);
      set({ diffOptions: next });
    },

    loadFileTimeline: async (filepath) => {
      try {
        const rel = filepath.includes("/")
          ? filepath.replace(new RegExp(`^${useWorkspaceStore.getState().rootName}/`), "")
          : filepath;
        const fileTimeline = await loadFileCommitLogSvc(
          ctxFromWorkspace(),
          rel,
          40
        );
        set({ fileTimeline });
      } catch (err) {
        set({ fileTimeline: [], error: (err as Error).message });
      }
    },

    setBlameEnabled: (on) => set({ blameEnabled: on }),

    loadBlame: async (filepath) => {
      try {
        const rootName = useWorkspaceStore.getState().rootName;
        const rel = filepath.startsWith(`${rootName}/`)
          ? filepath.slice(rootName.length + 1)
          : filepath;
        const blameLines = await blameFileSvc(ctxFromWorkspace(), rel, 40);
        set({ blameLines, blamePath: filepath });
      } catch (err) {
        set({
          blameLines: [],
          blamePath: filepath,
          error: (err as Error).message,
        });
      }
    },

    loadCommitGraph: async () => {
      try {
        const commitGraph = await loadCommitGraphSvc(ctxFromWorkspace(), 50);
        set({ commitGraph });
      } catch (err) {
        console.warn("[git] loadCommitGraph failed", err);
      }
    },

    checkoutBranch: async (name) => {
      set({ busy: true, error: null });
      try {
        await checkoutBranchSvc(ctxFromWorkspace(), name);
        await reloadTreeAfterCheckout();
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    createBranch: async (name, checkout = true) => {
      set({ busy: true, error: null });
      try {
        await createBranchSvc(ctxFromWorkspace(), name, checkout);
        if (checkout) await reloadTreeAfterCheckout();
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    deleteBranch: async (name) => {
      set({ busy: true, error: null });
      try {
        await deleteBranchSvc(ctxFromWorkspace(), name);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    mergeBranch: async (name) => {
      set({ busy: true, error: null });
      try {
        const result = await mergeBranchSvc(
          ctxFromWorkspace(),
          name,
          authorOf(get)
        );
        await reloadTreeAfterCheckout();
        await get().refresh();
        if (!result.ok) {
          set({
            error: result.message,
            busy: false,
          });
          useWorkspaceStore
            .getState()
            .setStatus(`Merge conflicts — resolve in Source Control`);
          return;
        }
        useWorkspaceStore
          .getState()
          .setStatus(
            result.kind === "already-merged"
              ? `Already up to date with ${name}`
              : `Merged ${name}`
          );
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    abortMerge: async () => {
      set({ busy: true, error: null });
      try {
        await abortMergeSvc(ctxFromWorkspace());
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Merge aborted");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    continueMerge: async (message) => {
      set({ busy: true, error: null });
      try {
        await continueMergeSvc(
          ctxFromWorkspace(),
          message ?? get().commitMessage,
          authorOf(get)
        );
        set({ commitMessage: "" });
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Merge committed");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    resolveConflict: async (filepath, mode) => {
      set({ busy: true, error: null });
      try {
        await resolveConflictFileSvc(ctxFromWorkspace(), filepath, mode);
        const ws = useWorkspaceStore.getState();
        const workspacePath = `${ws.rootName}/${filepath}`.replace(
          /\/+/g,
          "/"
        );
        // Reload buffer from disk after resolve
        await reloadTreeAfterCheckout();
        if (ws.buffers[workspacePath] != null) {
          // Tree reload may have refreshed non-dirty buffers; force-clear dirty
          useWorkspaceStore.setState((s) => ({
            dirty: { ...s.dirty, [workspacePath]: false },
          }));
        }
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    initRepo: async (defaultBranch = "main") => {
      set({ busy: true, error: null });
      try {
        await initRepository(ctxFromWorkspace(), defaultBranch);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Initialized git repository (${defaultBranch})`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    openWorkingDiff: async (filepath) => {
      const ctx = ctxFromWorkspace();
      const sides = await getWorkingDiffSides(ctx, filepath);
      const ws = useWorkspaceStore.getState();
      if (ws.buffers[sides.workspacePath] == null) {
        useWorkspaceStore.setState((s) => ({
          buffers: { ...s.buffers, [sides.workspacePath]: sides.modified },
        }));
      }
      ws.openGitDiff({
        mode: "working",
        filepath: sides.filepath,
        workspacePath: sides.workspacePath,
        originalRef: "HEAD",
        modifiedRef: "WORKDIR",
        originalLabel: sides.originalLabel,
        modifiedLabel: sides.modifiedLabel,
      });
    },

    openStagedDiff: async (filepath) => {
      const ctx = ctxFromWorkspace();
      const sides = await getStagedDiffSides(ctx, filepath);
      useWorkspaceStore.getState().openGitDiff({
        mode: "staged",
        filepath: sides.filepath,
        workspacePath: sides.workspacePath,
        originalRef: "HEAD",
        modifiedRef: "STAGE",
        originalLabel: sides.originalLabel,
        modifiedLabel: sides.modifiedLabel,
      });
    },

    openCommitDiff: async (filepath, oid, parentOid) => {
      const ctx = ctxFromWorkspace();
      const sides = await getCommitFileDiff(ctx, filepath, oid, parentOid);
      useWorkspaceStore.getState().openGitDiff({
        mode: "commits",
        filepath: sides.filepath,
        workspacePath: sides.workspacePath,
        originalRef: parentOid ?? "",
        modifiedRef: oid,
        originalLabel: sides.originalLabel,
        modifiedLabel: sides.modifiedLabel,
      });
    },

    openCompareDiff: async (filepath, baseOid, headOid) => {
      await get().openCommitDiff(filepath, headOid, baseOid);
    },

    stashPush: async (opts) => {
      set({ busy: true, error: null });
      try {
        await stashPushSvc(ctxFromWorkspace(), authorOf(get), opts);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Changes stashed");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    stashPop: async (refIdx = 0) => {
      set({ busy: true, error: null });
      try {
        await stashPopSvc(ctxFromWorkspace(), refIdx);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Stash popped");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    stashApply: async (refIdx = 0) => {
      set({ busy: true, error: null });
      try {
        await stashApplySvc(ctxFromWorkspace(), refIdx);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Stash applied");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    stashDrop: async (refIdx = 0) => {
      set({ busy: true, error: null });
      try {
        await stashDropSvc(ctxFromWorkspace(), refIdx);
        await get().refresh();
        useWorkspaceStore.getState().setStatus("Stash dropped");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    revertCommit: async (oid) => {
      set({ busy: true, error: null });
      try {
        await revertCommitSvc(ctxFromWorkspace(), oid, authorOf(get));
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Reverted ${oid.slice(0, 7)}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    cherryPick: async (oid) => {
      set({ busy: true, error: null });
      try {
        await cherryPickSvc(ctxFromWorkspace(), oid, authorOf(get));
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Cherry-picked ${oid.slice(0, 7)}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    resetToCommit: async (oid, mode) => {
      set({ busy: true, error: null });
      try {
        await resetToCommitSvc(ctxFromWorkspace(), oid, mode);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Reset (${mode}) to ${oid.slice(0, 7)}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    createTag: async (name, object) => {
      set({ busy: true, error: null });
      try {
        await createTagSvc(ctxFromWorkspace(), name, object);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    deleteTag: async (name) => {
      set({ busy: true, error: null });
      try {
        await deleteTagSvc(ctxFromWorkspace(), name);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    checkoutTag: async (name) => {
      set({ busy: true, error: null });
      try {
        await checkoutRefSvc(ctxFromWorkspace(), name);
        await reloadTreeAfterCheckout();
        await get().refresh();
        useWorkspaceStore
          .getState()
          .setStatus(`Checked out tag ${name} (detached)`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    stageHunks: async (filepath, changes) => {
      if (!changes.length) return;
      set({ busy: true, error: null });
      try {
        await stageLineChangesSvc(ctxFromWorkspace(), filepath, changes);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    unstageHunks: async (filepath, changes) => {
      if (!changes.length) return;
      set({ busy: true, error: null });
      try {
        await unstageLineChangesSvc(ctxFromWorkspace(), filepath, changes);
        await get().refresh();
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    addRemote: async (name, url) => {
      set({ busy: true, error: null });
      try {
        await addRemoteSvc(ctxFromWorkspace(), name, url);
        await get().refresh();
        useWorkspaceStore.getState().setStatus(`Added remote ${name}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    removeRemote: async (name) => {
      set({ busy: true, error: null });
      try {
        await removeRemoteSvc(ctxFromWorkspace(), name);
        await get().refresh();
        useWorkspaceStore.getState().setStatus(`Removed remote ${name}`);
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    setCorsProxy: async (proxy) => {
      set({ busy: true, error: null });
      try {
        await setCorsProxySettingSvc(ctxFromWorkspace(), proxy);
        set({ corsProxy: proxy.trim() });
        await get().refresh();
        useWorkspaceStore.getState().setStatus("CORS proxy updated");
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
      }
    },

    clearSavedCredentials: () => {
      clearAllStoredCredentials();
      useWorkspaceStore.getState().setStatus("Cleared saved git credentials");
    },

    fetchRemote: async (remote = "origin") => {
      set({ busy: true, error: null, progress: "Fetching…" });
      try {
        await fetchRemoteSvc(
          ctxFromWorkspace(),
          remote,
          onNetworkProgress(set)
        );
        await get().refresh();
        set({ progress: null });
        useWorkspaceStore.getState().setStatus(`Fetched ${remote}`);
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        throw err;
      }
    },

    pullRemote: async (remote) => {
      set({ busy: true, error: null, progress: "Pulling…" });
      try {
        await pullRemoteSvc(
          ctxFromWorkspace(),
          authorOf(get),
          remote,
          onNetworkProgress(set)
        );
        await reloadTreeAfterCheckout();
        await get().refresh();
        set({ progress: null });
        useWorkspaceStore.getState().setStatus("Pull complete");
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        await get().refresh().catch(() => undefined);
        throw err;
      }
    },

    pushBranch: async (opts) => {
      set({ busy: true, error: null, progress: "Pushing…" });
      try {
        await pushBranchSvc(ctxFromWorkspace(), {
          ...opts,
          onProgress: onNetworkProgress(set),
        });
        await get().refresh();
        set({ progress: null });
        useWorkspaceStore.getState().setStatus("Push complete");
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        throw err;
      }
    },

    publishBranch: async (remote = "origin") => {
      set({ busy: true, error: null, progress: "Publishing…" });
      try {
        await publishBranchSvc(
          ctxFromWorkspace(),
          remote,
          onNetworkProgress(set)
        );
        await get().refresh();
        set({ progress: null });
        useWorkspaceStore
          .getState()
          .setStatus(`Published branch to ${remote}`);
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        throw err;
      }
    },

    syncRemote: async () => {
      set({ busy: true, error: null, progress: "Syncing…" });
      try {
        const result = await syncWithRemoteSvc(
          ctxFromWorkspace(),
          authorOf(get),
          onNetworkProgress(set)
        );
        await reloadTreeAfterCheckout();
        await get().refresh();
        set({ progress: null });
        const msg =
          result === "uptodate"
            ? "Already up to date"
            : result === "pulled"
              ? "Synced (pulled)"
              : result === "pushed"
                ? "Synced (pushed)"
                : "Pulled remote changes (branch had diverged — push if needed)";
        useWorkspaceStore.getState().setStatus(msg);
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        await get().refresh().catch(() => undefined);
        throw err;
      }
    },

    cloneRepository: async (url) => {
      set({ busy: true, error: null, progress: "Clone: pick folder…" });
      try {
        const { pickDirectory, supportsDirectoryPicker } = await import(
          "@/lib/workspace/fs-access"
        );
        if (!supportsDirectoryPicker()) {
          throw new Error(
            "File System Access API required to clone into a local folder"
          );
        }
        const handle = await pickDirectory();
        if (!handle) {
          set({ busy: false, progress: null });
          return;
        }
        set({ progress: "Cloning…" });
        await cloneRepositorySvc(handle, url, onNetworkProgress(set));
        await useWorkspaceStore.getState().openFolderFromHandle(handle);
        await get().refresh();
        set({ progress: null, busy: false });
        useWorkspaceStore.getState().setStatus(`Cloned into ${handle.name}`);
      } catch (err) {
        set({
          busy: false,
          progress: null,
          error: (err as Error).message,
        });
        throw err;
      }
    },
  };
});

if (typeof window !== "undefined") {
  setAuthPromptHandler(async (info) => {
    return new Promise<AuthPromptResult>((resolve) => {
      authPromptResolve = resolve;
      useGitStore.setState({
        authPrompt: {
          url: info.url,
          host: info.host,
          reason: info.reason,
        },
      });
    });
  });
}

/** Debounced refresh for save/mutation hooks. */
export function scheduleGitRefresh(delayMs = 250): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void useGitStore.getState().refresh();
  }, delayMs);
}

/** Load diff editor sides for an open virtual tab. */
export async function loadDiffSidesForView(view: {
  mode: "working" | "staged" | "commits";
  filepath: string;
  originalRef: string;
  modifiedRef: string;
}): Promise<{ original: string; modified: string }> {
  const ctx = ctxFromWorkspace();
  if (view.mode === "working") {
    const s = await getWorkingDiffSides(ctx, view.filepath);
    return { original: s.original, modified: s.modified };
  }
  if (view.mode === "staged") {
    const s = await getStagedDiffSides(ctx, view.filepath);
    return { original: s.original, modified: s.modified };
  }
  const s = await getCommitFileDiff(
    ctx,
    view.filepath,
    view.modifiedRef,
    view.originalRef || null
  );
  return { original: s.original, modified: s.modified };
}
