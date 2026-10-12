"use client";

import { create } from "zustand";
import { useWorkspaceStore } from "@/lib/workspace/store";
import type {
  GitAuthor,
  GitChange,
  GitCommitFileChange,
  GitCommitInfo,
  GitResetMode,
  GitStashEntry,
  GitStatusSnapshot,
} from "./types";
import type { LineChange } from "./hunk-stage";
import type { ConflictResolveMode } from "./hunk-stage";
import {
  abortMerge as abortMergeSvc,
  checkoutBranch as checkoutBranchSvc,
  checkoutRef as checkoutRefSvc,
  cherryPickCommit as cherryPickSvc,
  commitStaged,
  continueMerge as continueMergeSvc,
  createBranch as createBranchSvc,
  createTag as createTagSvc,
  deleteLocalBranch as deleteBranchSvc,
  deleteLocalTag as deleteTagSvc,
  getCommitFileDiff,
  getStagedDiffSides,
  getWorkingDiffSides,
  initRepository,
  listCommitFiles,
  listLocalBranches,
  listLocalTags,
  listStash,
  loadCommitLog,
  loadGitStatus,
  mergeBranch as mergeBranchSvc,
  resetToCommit as resetToCommitSvc,
  resolveConflictFile as resolveConflictFileSvc,
  revertCommit as revertCommitSvc,
  stageAll,
  stageLineChanges as stageLineChangesSvc,
  stagePaths,
  stashApply as stashApplySvc,
  stashDrop as stashDropSvc,
  stashPop as stashPopSvc,
  stashPush as stashPushSvc,
  unstageAll,
  unstageLineChanges as unstageLineChangesSvc,
  unstagePaths,
  type GitContext,
} from "./git-service";

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
  setAuthorName: (name: string) => void;
  setAuthorEmail: (email: string) => void;
  setCommitMessage: (message: string) => void;
  refresh: () => Promise<void>;
  stage: (filepaths: string[]) => Promise<void>;
  unstage: (filepaths: string[]) => Promise<void>;
  stageAllChanges: () => Promise<void>;
  unstageAllChanges: () => Promise<void>;
  commit: (message?: string) => Promise<string>;
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
};

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshSeq = 0;

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

    setAuthorName: (name) => {
      set({ authorName: name });
      persistAuthor({ name, email: get().authorEmail });
    },

    setAuthorEmail: (email) => {
      set({ authorEmail: email });
      persistAuthor({ name: get().authorName, email });
    },

    setCommitMessage: (message) => set({ commitMessage: message }),

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
      } else {
        branches = [];
        tags = [];
        commits = [];
        stashes = [];
      }

      if (seq !== refreshSeq) return;
      set({
        ...snap,
        branches,
        tags,
        commits,
        stashes,
        busy: false,
      });
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

    commit: async (message) => {
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
        const sha = await commitStaged(ctxFromWorkspace(), msg, authorOf(get));
        set({ commitMessage: "" });
        await get().refresh();
        return sha;
      } catch (err) {
        set({ busy: false, error: (err as Error).message });
        throw err;
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
  };
});

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
