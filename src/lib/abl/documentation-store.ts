"use client";

import { create } from "zustand";
import {
  getAblDocEntry,
  type AblDocEntry,
} from "./reference";
import type { AblSymbol } from "./symbols";
import { formatSymbolAsDocEntry } from "./docs";

export type DocTopic =
  | { type: "language"; name: string }
  | { type: "symbol"; symbol: AblSymbol };

type DocumentationState = {
  topic: DocTopic | null;
  /** Search text in the browse list */
  filter: string;
  history: DocTopic[];
  historyIndex: number;

  setFilter: (filter: string) => void;
  openLanguageDoc: (name: string) => void;
  openSymbolDoc: (symbol: AblSymbol) => void;
  openTopic: (topic: DocTopic) => void;
  goBack: () => void;
  goForward: () => void;
  clearTopic: () => void;
};

function topicsEqual(a: DocTopic | null, b: DocTopic | null): boolean {
  if (!a || !b) return a === b;
  if (a.type !== b.type) return false;
  if (a.type === "language" && b.type === "language") {
    return a.name.toUpperCase() === b.name.toUpperCase();
  }
  if (a.type === "symbol" && b.type === "symbol") {
    return (
      a.symbol.name === b.symbol.name &&
      a.symbol.kind === b.symbol.kind &&
      a.symbol.path === b.symbol.path &&
      a.symbol.startLine === b.symbol.startLine
    );
  }
  return false;
}

function pushTopic(
  state: DocumentationState,
  topic: DocTopic
): Partial<DocumentationState> {
  if (topicsEqual(state.topic, topic)) return {};
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  trimmed.push(topic);
  return {
    topic,
    history: trimmed,
    historyIndex: trimmed.length - 1,
  };
}

export function resolveDocEntry(topic: DocTopic | null): AblDocEntry | null {
  if (!topic) return null;
  if (topic.type === "language") return getAblDocEntry(topic.name);
  return formatSymbolAsDocEntry(topic.symbol);
}

export const useDocumentationStore = create<DocumentationState>((set, get) => ({
  topic: null,
  filter: "",
  history: [],
  historyIndex: -1,

  setFilter: (filter) => set({ filter }),

  openLanguageDoc: (name) => {
    set((s) => pushTopic(s, { type: "language", name }));
  },

  openSymbolDoc: (symbol) => {
    set((s) => pushTopic(s, { type: "symbol", symbol }));
  },

  openTopic: (topic) => {
    set((s) => pushTopic(s, topic));
  },

  goBack: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const next = historyIndex - 1;
    set({ historyIndex: next, topic: history[next] ?? null });
  },

  goForward: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    set({ historyIndex: next, topic: history[next] ?? null });
  },

  clearTopic: () => set({ topic: null }),
}));
