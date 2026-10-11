"use client";

import { create } from "zustand";
import type { OutputEntry } from "./types";

type OutputState = {
  entries: OutputEntry[];
  busy: boolean;
  abortController: AbortController | null;
  appendEntry: (entry: OutputEntry) => void;
  updateEntry: (id: string, patch: Partial<OutputEntry>) => void;
  clear: () => void;
  setBusy: (busy: boolean, controller?: AbortController | null) => void;
  cancel: () => void;
};

export const useOutputStore = create<OutputState>((set, get) => ({
  entries: [],
  busy: false,
  abortController: null,

  appendEntry: (entry) =>
    set((s) => ({ entries: [entry, ...s.entries].slice(0, 50) })),

  updateEntry: (id, patch) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  clear: () => set({ entries: [] }),

  setBusy: (busy, controller = null) =>
    set({ busy, abortController: busy ? controller : null }),

  cancel: () => {
    const c = get().abortController;
    c?.abort();
    set({ busy: false, abortController: null });
  },
}));
