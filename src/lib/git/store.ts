"use client";

import { create } from "zustand";
import { useWorkspaceStore } from "@/lib/workspace/store";
import type { GitAuthor, GitChange, GitStatusSnapshot } from "./types";
import {
  commitStaged,
  loadGitStatus,
  stageAll,
  stagePaths,
  unstageAll,
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

type GitState = GitStatusSnapshot & {
  busy: boolean;
  authorName: string;
  authorEmail: string;
  commitMessage: string;
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
    decorations: {},
    error: null,
    busy: false,
    authorName: author.name,
    authorEmail: author.email,
    commitMessage: "",

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
        decorations: {},
        error: null,
        busy: false,
      }),

    refresh: async () => {
      const seq = ++refreshSeq;
      set({ busy: true });
      const snap = await loadGitStatus(ctxFromWorkspace());
      if (seq !== refreshSeq) return;
      set({
        ...snap,
        busy: false,
      });
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
        const sha = await commitStaged(ctxFromWorkspace(), msg, {
          name: get().authorName,
          email: get().authorEmail,
        });
        set({ commitMessage: "" });
        await get().refresh();
        return sha;
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
