"use client";

import { create } from "zustand";
import {
  builtinTypeToAblSymbol,
  getBuiltinType,
  searchBuiltinTypes,
} from "./builtin/builtin-types";
import {
  ablReferenceUrl,
  getAblDocEntry,
  searchAblDocs,
  type AblDocEntry,
} from "./reference";
import type { AblSymbol } from "./symbols";
import { formatSymbolAsDocEntry, symbolDocsUrl } from "./docs";

export type DocTopic =
  | { type: "language"; name: string }
  | { type: "symbol"; symbol: AblSymbol }
  | { type: "builtin"; name: string };

export type DocListItem =
  | { kind: "language"; entry: AblDocEntry }
  | { kind: "builtin"; name: string; summary: string; typeKind: string };

type DocumentationState = {
  topic: DocTopic | null;
  /** Search text in the browse list */
  filter: string;
  history: DocTopic[];
  historyIndex: number;

  setFilter: (filter: string) => void;
  openLanguageDoc: (name: string) => void;
  openSymbolDoc: (symbol: AblSymbol) => void;
  openBuiltinDoc: (name: string) => void;
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
  if (a.type === "builtin" && b.type === "builtin") {
    return a.name.toLowerCase() === b.name.toLowerCase();
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
  if (topic.type === "builtin") {
    const t = getBuiltinType(topic.name);
    if (!t) return null;
    return formatSymbolAsDocEntry(builtinTypeToAblSymbol(t));
  }
  return formatSymbolAsDocEntry(topic.symbol);
}

export function resolveDocExternalUrl(topic: DocTopic | null): string | null {
  if (!topic) return null;
  if (topic.type === "builtin") {
    return getBuiltinType(topic.name)?.docsUrl ?? null;
  }
  if (topic.type === "symbol") {
    return symbolDocsUrl(topic.symbol);
  }
  const entry = getAblDocEntry(topic.name);
  if (!entry?.docsPage) return null;
  return ablReferenceUrl(entry.docsPage);
}

/** Unified browse list: keywords + built-in types. */
export function searchDocumentation(query: string): DocListItem[] {
  const lang = searchAblDocs(query).map(
    (entry): DocListItem => ({ kind: "language", entry })
  );
  const builtins = searchBuiltinTypes(query).map(
    (t): DocListItem => ({
      kind: "builtin",
      name: t.name,
      summary: t.summary,
      typeKind: t.kind,
    })
  );
  // Prefer exact-ish builtin matches when query looks like a type name
  const q = query.trim().toLowerCase();
  if (q.includes(".") || q.startsWith("progress") || q.startsWith("openedge")) {
    return [...builtins, ...lang].slice(0, 200);
  }
  return [...lang, ...builtins].slice(0, 200);
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
    if (symbol.path?.startsWith("builtin:")) {
      set((s) =>
        pushTopic(s, {
          type: "builtin",
          name: symbol.path!.slice("builtin:".length),
        })
      );
      return;
    }
    set((s) => pushTopic(s, { type: "symbol", symbol }));
  },

  openBuiltinDoc: (name) => {
    set((s) => pushTopic(s, { type: "builtin", name }));
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
