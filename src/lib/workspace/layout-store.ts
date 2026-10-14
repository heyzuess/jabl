"use client";

import { create } from "zustand";

export type PaneId =
  | "explorer"
  | "editor"
  | "terminal"
  | "documentation"
  | "output"
  | "gitHistory"
  | "preview";
export type SidebarSide = "left" | "right";
export type SidebarView = "explorer" | "scm";
export type PanelPosition = "bottom" | "right" | "left";
export type SnapZone =
  | "left"
  | "right"
  | "bottom"
  | "center-left"
  | "center-right";

export type DockablePane = Exclude<PaneId, "editor">;

export type LayoutState = {
  sidebarVisible: boolean;
  sidebarView: SidebarView;
  terminalVisible: boolean;
  documentationVisible: boolean;
  outputVisible: boolean;
  gitHistoryVisible: boolean;
  previewVisible: boolean;
  editorVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  docsPosition: PanelPosition;
  outputPosition: PanelPosition;
  gitHistoryPosition: PanelPosition;
  previewPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
    documentation: boolean;
    output: boolean;
    gitHistory: boolean;
    preview: boolean;
    editor: boolean;
  };
  /** Last known size % before minimize (restored when expanding). */
  paneSizes: Partial<Record<PaneId, string>>;
  /** Ephemeral: which secondary pane chrome is being dragged for snap */
  draggingPane: DockablePane | null;
  snapTarget: SnapZone | null;

  toggleSidebar: () => void;
  toggleTerminal: () => void;
  toggleDocumentation: () => void;
  toggleOutput: () => void;
  toggleGitHistory: () => void;
  togglePreview: () => void;
  toggleEditor: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  revealSourceControl: () => void;
  setTerminalVisible: (visible: boolean) => void;
  setDocumentationVisible: (visible: boolean) => void;
  setOutputVisible: (visible: boolean) => void;
  setGitHistoryVisible: (visible: boolean) => void;
  setPreviewVisible: (visible: boolean) => void;
  setEditorVisible: (visible: boolean) => void;
  setSidebarSide: (side: SidebarSide) => void;
  setPanelPosition: (position: PanelPosition) => void;
  setDocsPosition: (position: PanelPosition) => void;
  setOutputPosition: (position: PanelPosition) => void;
  setGitHistoryPosition: (position: PanelPosition) => void;
  setPreviewPosition: (position: PanelPosition) => void;
  maximizePane: (pane: PaneId) => void;
  restoreLayout: () => void;
  toggleMaximize: (pane: PaneId) => void;
  minimizePane: (pane: PaneId) => void;
  expandMinimized: (pane: PaneId) => void;
  closePane: (pane: PaneId) => void;
  startPaneDrag: (pane: DockablePane) => void;
  updateSnapTarget: (zone: SnapZone | null) => void;
  endPaneDrag: (apply: boolean) => void;
  applySnap: (pane: DockablePane, zone: SnapZone) => void;
  /** Show documentation pane and optionally focus a topic opener callback side-effect */
  revealDocumentation: () => void;
  revealOutput: () => void;
  revealGitHistory: () => void;
  revealPreview: () => void;
  revealEditor: () => void;
};

type PersistedLayout = {
  sidebarVisible: boolean;
  sidebarView: SidebarView;
  terminalVisible: boolean;
  documentationVisible: boolean;
  outputVisible: boolean;
  gitHistoryVisible: boolean;
  previewVisible: boolean;
  editorVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  docsPosition: PanelPosition;
  outputPosition: PanelPosition;
  gitHistoryPosition: PanelPosition;
  previewPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
    documentation: boolean;
    output: boolean;
    gitHistory: boolean;
    preview: boolean;
    editor: boolean;
  };
  paneSizes: Partial<Record<PaneId, string>>;
};

const STORAGE_KEY = "jabl-layout";

const DEFAULT_PANE_SIZES: Record<PaneId, string> = {
  explorer: "22%",
  editor: "72%",
  terminal: "28%",
  documentation: "28%",
  output: "28%",
  gitHistory: "28%",
  preview: "28%",
};

const DEFAULT_LAYOUT: PersistedLayout = {
  sidebarVisible: true,
  sidebarView: "explorer",
  terminalVisible: true,
  documentationVisible: false,
  outputVisible: false,
  gitHistoryVisible: false,
  previewVisible: false,
  editorVisible: true,
  sidebarSide: "left",
  panelPosition: "bottom",
  docsPosition: "right",
  outputPosition: "bottom",
  gitHistoryPosition: "bottom",
  previewPosition: "right",
  maximized: null,
  minimized: {
    explorer: false,
    terminal: false,
    documentation: false,
    output: false,
    gitHistory: false,
    preview: false,
    editor: false,
  },
  paneSizes: {},
};

function panelDomIdsFor(pane: PaneId): string[] {
  switch (pane) {
    case "documentation":
      return ["documentation", "documentation-bottom"];
    case "output":
      return ["output", "output-bottom"];
    case "gitHistory":
      return ["gitHistory", "gitHistory-bottom"];
    case "preview":
      return ["preview", "preview-bottom"];
    default:
      return [pane];
  }
}

/** Capture current panel size as a percentage of its group. */
export function capturePaneSize(pane: PaneId): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const id of panelDomIdsFor(pane)) {
    const el = document.getElementById(id);
    if (!el?.parentElement) continue;
    const parent = el.parentElement;
    const vertical = getComputedStyle(parent).flexDirection.includes("column");
    const total = vertical ? parent.clientHeight : parent.clientWidth;
    const size = vertical ? el.clientHeight : el.clientWidth;
    if (total <= 0 || size <= 0) continue;
    const pct = Math.round((size / total) * 1000) / 10;
    if (pct > 0 && pct <= 100) return `${pct}%`;
  }
  return undefined;
}

export function sizeForPane(
  paneSizes: Partial<Record<PaneId, string>>,
  pane: PaneId,
  fallback?: string
): string {
  return paneSizes[pane] ?? fallback ?? DEFAULT_PANE_SIZES[pane];
}

function isSidebarView(v: unknown): v is SidebarView {
  return v === "explorer" || v === "scm";
}

function isPaneId(v: unknown): v is PaneId {
  return (
    v === "explorer" ||
    v === "editor" ||
    v === "terminal" ||
    v === "documentation" ||
    v === "output" ||
    v === "gitHistory" ||
    v === "preview"
  );
}

function isPanelPosition(v: unknown): v is PanelPosition {
  return v === "bottom" || v === "left" || v === "right";
}

function loadPersisted(): PersistedLayout {
  if (typeof window === "undefined") return { ...DEFAULT_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PersistedLayout>;
    return {
      sidebarVisible: parsed.sidebarVisible ?? true,
      sidebarView: isSidebarView(parsed.sidebarView)
        ? parsed.sidebarView
        : "explorer",
      terminalVisible: parsed.terminalVisible ?? true,
      documentationVisible: parsed.documentationVisible ?? false,
      outputVisible: parsed.outputVisible ?? false,
      gitHistoryVisible: parsed.gitHistoryVisible ?? false,
      previewVisible: parsed.previewVisible ?? false,
      editorVisible: parsed.editorVisible ?? true,
      sidebarSide: parsed.sidebarSide === "right" ? "right" : "left",
      panelPosition: isPanelPosition(parsed.panelPosition)
        ? parsed.panelPosition
        : "bottom",
      docsPosition: isPanelPosition(parsed.docsPosition)
        ? parsed.docsPosition
        : "right",
      outputPosition: isPanelPosition(parsed.outputPosition)
        ? parsed.outputPosition
        : "bottom",
      gitHistoryPosition: isPanelPosition(parsed.gitHistoryPosition)
        ? parsed.gitHistoryPosition
        : "bottom",
      previewPosition: isPanelPosition(parsed.previewPosition)
        ? parsed.previewPosition
        : "right",
      maximized: isPaneId(parsed.maximized) ? parsed.maximized : null,
      minimized: {
        explorer: !!parsed.minimized?.explorer,
        terminal: !!parsed.minimized?.terminal,
        documentation: !!parsed.minimized?.documentation,
        output: !!parsed.minimized?.output,
        gitHistory: !!parsed.minimized?.gitHistory,
        preview: !!parsed.minimized?.preview,
        editor: !!parsed.minimized?.editor,
      },
      paneSizes:
        parsed.paneSizes && typeof parsed.paneSizes === "object"
          ? { ...parsed.paneSizes }
          : {},
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

function persist(state: LayoutState) {
  if (typeof window === "undefined") return;
  const data: PersistedLayout = {
    sidebarVisible: state.sidebarVisible,
    sidebarView: state.sidebarView,
    terminalVisible: state.terminalVisible,
    documentationVisible: state.documentationVisible,
    outputVisible: state.outputVisible,
    gitHistoryVisible: state.gitHistoryVisible,
    previewVisible: state.previewVisible,
    editorVisible: state.editorVisible,
    sidebarSide: state.sidebarSide,
    panelPosition: state.panelPosition,
    docsPosition: state.docsPosition,
    outputPosition: state.outputPosition,
    gitHistoryPosition: state.gitHistoryPosition,
    previewPosition: state.previewPosition,
    maximized: state.maximized,
    minimized: state.minimized,
    paneSizes: state.paneSizes,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function clearMinimized(): LayoutState["minimized"] {
  return {
    explorer: false,
    terminal: false,
    documentation: false,
    output: false,
    gitHistory: false,
    preview: false,
    editor: false,
  };
}

function applySnapToState(
  state: LayoutState,
  pane: DockablePane,
  zone: SnapZone
): Partial<LayoutState> {
  if (pane === "explorer") {
    if (zone === "left" || zone === "center-left") {
      return {
        sidebarVisible: true,
        sidebarSide: "left",
        maximized: null,
        minimized: { ...state.minimized, explorer: false },
      };
    }
    if (zone === "right" || zone === "center-right") {
      return {
        sidebarVisible: true,
        sidebarSide: "right",
        maximized: null,
        minimized: { ...state.minimized, explorer: false },
      };
    }
    return {
      sidebarVisible: true,
      maximized: null,
      minimized: { ...state.minimized, explorer: false },
    };
  }

  if (pane === "documentation") {
    if (zone === "bottom") {
      return {
        documentationVisible: true,
        docsPosition: "bottom",
        maximized: null,
        minimized: { ...state.minimized, documentation: false },
      };
    }
    if (zone === "left" || zone === "center-left") {
      return {
        documentationVisible: true,
        docsPosition: "left",
        maximized: null,
        minimized: { ...state.minimized, documentation: false },
      };
    }
    if (zone === "right" || zone === "center-right") {
      return {
        documentationVisible: true,
        docsPosition: "right",
        maximized: null,
        minimized: { ...state.minimized, documentation: false },
      };
    }
    return {
      documentationVisible: true,
      maximized: null,
      minimized: { ...state.minimized, documentation: false },
    };
  }

  if (pane === "output") {
    if (zone === "bottom") {
      return {
        outputVisible: true,
        outputPosition: "bottom",
        maximized: null,
        minimized: { ...state.minimized, output: false },
      };
    }
    if (zone === "left" || zone === "center-left") {
      return {
        outputVisible: true,
        outputPosition: "left",
        maximized: null,
        minimized: { ...state.minimized, output: false },
      };
    }
    if (zone === "right" || zone === "center-right") {
      return {
        outputVisible: true,
        outputPosition: "right",
        maximized: null,
        minimized: { ...state.minimized, output: false },
      };
    }
    return {
      outputVisible: true,
      maximized: null,
      minimized: { ...state.minimized, output: false },
    };
  }

  if (pane === "gitHistory") {
    if (zone === "bottom") {
      return {
        gitHistoryVisible: true,
        gitHistoryPosition: "bottom",
        maximized: null,
        minimized: { ...state.minimized, gitHistory: false },
      };
    }
    if (zone === "left" || zone === "center-left") {
      return {
        gitHistoryVisible: true,
        gitHistoryPosition: "left",
        maximized: null,
        minimized: { ...state.minimized, gitHistory: false },
      };
    }
    if (zone === "right" || zone === "center-right") {
      return {
        gitHistoryVisible: true,
        gitHistoryPosition: "right",
        maximized: null,
        minimized: { ...state.minimized, gitHistory: false },
      };
    }
    return {
      gitHistoryVisible: true,
      maximized: null,
      minimized: { ...state.minimized, gitHistory: false },
    };
  }

  if (pane === "preview") {
    if (zone === "bottom") {
      return {
        previewVisible: true,
        previewPosition: "bottom",
        maximized: null,
        minimized: { ...state.minimized, preview: false },
      };
    }
    if (zone === "left" || zone === "center-left") {
      return {
        previewVisible: true,
        previewPosition: "left",
        maximized: null,
        minimized: { ...state.minimized, preview: false },
      };
    }
    if (zone === "right" || zone === "center-right") {
      return {
        previewVisible: true,
        previewPosition: "right",
        maximized: null,
        minimized: { ...state.minimized, preview: false },
      };
    }
    return {
      previewVisible: true,
      maximized: null,
      minimized: { ...state.minimized, preview: false },
    };
  }

  // terminal
  if (zone === "bottom") {
    return {
      terminalVisible: true,
      panelPosition: "bottom",
      maximized: null,
      minimized: { ...state.minimized, terminal: false },
    };
  }
  if (zone === "left" || zone === "center-left") {
    return {
      terminalVisible: true,
      panelPosition: "left",
      maximized: null,
      minimized: { ...state.minimized, terminal: false },
    };
  }
  if (zone === "right" || zone === "center-right") {
    return {
      terminalVisible: true,
      panelPosition: "right",
      maximized: null,
      minimized: { ...state.minimized, terminal: false },
    };
  }
  return {
    terminalVisible: true,
    maximized: null,
    minimized: { ...state.minimized, terminal: false },
  };
}

function visibilityPatchForMinimize(pane: PaneId): Partial<LayoutState> {
  if (pane === "explorer") return { sidebarVisible: true };
  if (pane === "terminal") return { terminalVisible: true };
  if (pane === "documentation") return { documentationVisible: true };
  if (pane === "gitHistory") return { gitHistoryVisible: true };
  if (pane === "preview") return { previewVisible: true };
  if (pane === "editor") return { editorVisible: true };
  return { outputVisible: true };
}

const initial = loadPersisted();

export const useLayoutStore = create<LayoutState>((set, get) => ({
  ...initial,
  draggingPane: null,
  snapTarget: null,

  toggleSidebar: () => {
    set((s) => {
      const next = {
        ...s,
        sidebarVisible: !s.sidebarVisible,
        maximized: s.maximized === "explorer" ? null : s.maximized,
        minimized: s.sidebarVisible
          ? s.minimized
          : { ...s.minimized, explorer: false },
      };
      persist(next);
      return next;
    });
  },

  setSidebarView: (view) => {
    set((s) => {
      const next = {
        ...s,
        sidebarView: view,
        sidebarVisible: true,
        maximized: s.maximized === "explorer" ? null : s.maximized,
        minimized: { ...s.minimized, explorer: false },
      };
      persist(next);
      return next;
    });
  },

  revealSourceControl: () => {
    set((s) => {
      const next = {
        ...s,
        sidebarView: "scm" as const,
        sidebarVisible: true,
        maximized: s.maximized === "explorer" ? null : s.maximized,
        minimized: { ...s.minimized, explorer: false },
      };
      persist(next);
      return next;
    });
  },

  toggleTerminal: () => {
    set((s) => {
      const next = {
        ...s,
        terminalVisible: !s.terminalVisible,
        maximized: s.maximized === "terminal" ? null : s.maximized,
        minimized: s.terminalVisible
          ? s.minimized
          : { ...s.minimized, terminal: false },
      };
      persist(next);
      return next;
    });
  },

  toggleDocumentation: () => {
    set((s) => {
      const next = {
        ...s,
        documentationVisible: !s.documentationVisible,
        maximized: s.maximized === "documentation" ? null : s.maximized,
        minimized: s.documentationVisible
          ? s.minimized
          : { ...s.minimized, documentation: false },
      };
      persist(next);
      return next;
    });
  },

  toggleOutput: () => {
    set((s) => {
      const next = {
        ...s,
        outputVisible: !s.outputVisible,
        maximized: s.maximized === "output" ? null : s.maximized,
        minimized: s.outputVisible
          ? s.minimized
          : { ...s.minimized, output: false },
      };
      persist(next);
      return next;
    });
  },

  toggleGitHistory: () => {
    set((s) => {
      const next = {
        ...s,
        gitHistoryVisible: !s.gitHistoryVisible,
        maximized: s.maximized === "gitHistory" ? null : s.maximized,
        minimized: s.gitHistoryVisible
          ? s.minimized
          : { ...s.minimized, gitHistory: false },
      };
      persist(next);
      return next;
    });
  },

  togglePreview: () => {
    set((s) => {
      const next = {
        ...s,
        previewVisible: !s.previewVisible,
        maximized: s.maximized === "preview" ? null : s.maximized,
        minimized: s.previewVisible
          ? s.minimized
          : { ...s.minimized, preview: false },
      };
      persist(next);
      return next;
    });
  },

  toggleEditor: () => {
    set((s) => {
      const next = {
        ...s,
        editorVisible: !s.editorVisible,
        maximized: s.maximized === "editor" ? null : s.maximized,
        minimized: s.editorVisible
          ? s.minimized
          : { ...s.minimized, editor: false },
      };
      persist(next);
      return next;
    });
  },

  setSidebarVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        sidebarVisible: visible,
        maximized: !visible && s.maximized === "explorer" ? null : s.maximized,
        minimized: visible
          ? { ...s.minimized, explorer: false }
          : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setTerminalVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        terminalVisible: visible,
        maximized: !visible && s.maximized === "terminal" ? null : s.maximized,
        minimized: visible
          ? { ...s.minimized, terminal: false }
          : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setDocumentationVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        documentationVisible: visible,
        maximized:
          !visible && s.maximized === "documentation" ? null : s.maximized,
        minimized: visible
          ? { ...s.minimized, documentation: false }
          : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setOutputVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        outputVisible: visible,
        maximized: !visible && s.maximized === "output" ? null : s.maximized,
        minimized: visible ? { ...s.minimized, output: false } : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setGitHistoryVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        gitHistoryVisible: visible,
        maximized:
          !visible && s.maximized === "gitHistory" ? null : s.maximized,
        minimized: visible
          ? { ...s.minimized, gitHistory: false }
          : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setPreviewVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        previewVisible: visible,
        maximized: !visible && s.maximized === "preview" ? null : s.maximized,
        minimized: visible ? { ...s.minimized, preview: false } : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  setEditorVisible: (visible) => {
    set((s) => {
      const next = {
        ...s,
        editorVisible: visible,
        maximized: !visible && s.maximized === "editor" ? null : s.maximized,
        minimized: visible ? { ...s.minimized, editor: false } : s.minimized,
      };
      persist(next);
      return next;
    });
  },

  revealDocumentation: () => {
    set((s) => {
      const next = {
        ...s,
        documentationVisible: true,
        maximized:
          s.maximized === "documentation" ? s.maximized : null,
        minimized: { ...s.minimized, documentation: false },
      };
      persist(next);
      return next;
    });
  },

  revealOutput: () => {
    set((s) => {
      const next = {
        ...s,
        outputVisible: true,
        maximized: s.maximized === "output" ? s.maximized : null,
        minimized: { ...s.minimized, output: false },
      };
      persist(next);
      return next;
    });
  },

  revealGitHistory: () => {
    set((s) => {
      const next = {
        ...s,
        gitHistoryVisible: true,
        maximized: s.maximized === "gitHistory" ? s.maximized : null,
        minimized: { ...s.minimized, gitHistory: false },
      };
      persist(next);
      return next;
    });
  },

  revealPreview: () => {
    set((s) => {
      const next = {
        ...s,
        previewVisible: true,
        previewPosition: s.previewPosition || "right",
        maximized: s.maximized === "preview" ? s.maximized : null,
        minimized: { ...s.minimized, preview: false },
      };
      persist(next);
      return next;
    });
  },

  revealEditor: () => {
    set((s) => {
      const next = {
        ...s,
        editorVisible: true,
        maximized: s.maximized === "editor" ? s.maximized : null,
        minimized: { ...s.minimized, editor: false },
      };
      persist(next);
      return next;
    });
  },

  setSidebarSide: (side) => {
    set((s) => {
      const next = { ...s, sidebarSide: side, sidebarVisible: true };
      persist(next);
      return next;
    });
  },

  setPanelPosition: (position) => {
    set((s) => {
      const next = {
        ...s,
        panelPosition: position,
        terminalVisible: true,
        minimized: { ...s.minimized, terminal: false },
      };
      persist(next);
      return next;
    });
  },

  setDocsPosition: (position) => {
    set((s) => {
      const next = {
        ...s,
        docsPosition: position,
        documentationVisible: true,
        minimized: { ...s.minimized, documentation: false },
      };
      persist(next);
      return next;
    });
  },

  setOutputPosition: (position) => {
    set((s) => {
      const next = {
        ...s,
        outputPosition: position,
        outputVisible: true,
        minimized: { ...s.minimized, output: false },
      };
      persist(next);
      return next;
    });
  },

  setGitHistoryPosition: (position) => {
    set((s) => {
      const next = {
        ...s,
        gitHistoryPosition: position,
        gitHistoryVisible: true,
        minimized: { ...s.minimized, gitHistory: false },
      };
      persist(next);
      return next;
    });
  },

  setPreviewPosition: (position) => {
    set((s) => {
      const next = {
        ...s,
        previewPosition: position,
        previewVisible: true,
        minimized: { ...s.minimized, preview: false },
      };
      persist(next);
      return next;
    });
  },

  maximizePane: (pane) => {
    set((s) => {
      const next = {
        ...s,
        maximized: pane,
        minimized: clearMinimized(),
      };
      persist(next);
      return next;
    });
  },

  restoreLayout: () => {
    set((s) => {
      const next = { ...s, maximized: null };
      persist(next);
      return next;
    });
  },

  toggleMaximize: (pane) => {
    set((s) => {
      const next = {
        ...s,
        maximized: s.maximized === pane ? null : pane,
        minimized:
          s.maximized === pane ? s.minimized : clearMinimized(),
      };
      persist(next);
      return next;
    });
  },

  minimizePane: (pane) => {
    const captured = capturePaneSize(pane);
    set((s) => {
      const next = {
        ...s,
        maximized: s.maximized === pane ? null : s.maximized,
        minimized: { ...s.minimized, [pane]: true },
        paneSizes: captured
          ? { ...s.paneSizes, [pane]: captured }
          : s.paneSizes,
        ...visibilityPatchForMinimize(pane),
      };
      persist(next);
      return next;
    });
  },

  expandMinimized: (pane) => {
    set((s) => {
      const next = {
        ...s,
        minimized: { ...s.minimized, [pane]: false },
        ...visibilityPatchForMinimize(pane),
      };
      persist(next);
      return next;
    });
  },

  closePane: (pane) => {
    set((s) => {
      let next: LayoutState = s;
      if (pane === "explorer") {
        next = {
          ...s,
          sidebarVisible: false,
          maximized: s.maximized === "explorer" ? null : s.maximized,
          minimized: { ...s.minimized, explorer: false },
        };
      } else if (pane === "editor") {
        next = {
          ...s,
          editorVisible: false,
          maximized: s.maximized === "editor" ? null : s.maximized,
          minimized: { ...s.minimized, editor: false },
        };
      } else if (pane === "terminal") {
        next = {
          ...s,
          terminalVisible: false,
          maximized: s.maximized === "terminal" ? null : s.maximized,
          minimized: { ...s.minimized, terminal: false },
        };
      } else if (pane === "documentation") {
        next = {
          ...s,
          documentationVisible: false,
          maximized: s.maximized === "documentation" ? null : s.maximized,
          minimized: { ...s.minimized, documentation: false },
        };
      } else if (pane === "output") {
        next = {
          ...s,
          outputVisible: false,
          maximized: s.maximized === "output" ? null : s.maximized,
          minimized: { ...s.minimized, output: false },
        };
      } else if (pane === "gitHistory") {
        next = {
          ...s,
          gitHistoryVisible: false,
          maximized: s.maximized === "gitHistory" ? null : s.maximized,
          minimized: { ...s.minimized, gitHistory: false },
        };
      } else if (pane === "preview") {
        next = {
          ...s,
          previewVisible: false,
          maximized: s.maximized === "preview" ? null : s.maximized,
          minimized: { ...s.minimized, preview: false },
        };
      }
      persist(next);
      return next;
    });
  },

  startPaneDrag: (pane) => {
    set({ draggingPane: pane, snapTarget: null });
  },

  updateSnapTarget: (zone) => {
    set({ snapTarget: zone });
  },

  endPaneDrag: (apply) => {
    const { draggingPane, snapTarget } = get();
    if (apply && draggingPane && snapTarget) {
      get().applySnap(draggingPane, snapTarget);
    }
    set({ draggingPane: null, snapTarget: null });
  },

  applySnap: (pane, zone) => {
    set((s) => {
      const patch = applySnapToState(s, pane, zone);
      const next = { ...s, ...patch, draggingPane: null, snapTarget: null };
      persist(next);
      return next;
    });
  },
}));
