"use client";

import { create } from "zustand";

export type PaneId =
  | "explorer"
  | "editor"
  | "terminal"
  | "documentation"
  | "output";
export type SidebarSide = "left" | "right";
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
  terminalVisible: boolean;
  documentationVisible: boolean;
  outputVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  docsPosition: PanelPosition;
  outputPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
    documentation: boolean;
    output: boolean;
  };
  /** Ephemeral: which secondary pane chrome is being dragged for snap */
  draggingPane: DockablePane | null;
  snapTarget: SnapZone | null;

  toggleSidebar: () => void;
  toggleTerminal: () => void;
  toggleDocumentation: () => void;
  toggleOutput: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setTerminalVisible: (visible: boolean) => void;
  setDocumentationVisible: (visible: boolean) => void;
  setOutputVisible: (visible: boolean) => void;
  setSidebarSide: (side: SidebarSide) => void;
  setPanelPosition: (position: PanelPosition) => void;
  setDocsPosition: (position: PanelPosition) => void;
  setOutputPosition: (position: PanelPosition) => void;
  maximizePane: (pane: PaneId) => void;
  restoreLayout: () => void;
  toggleMaximize: (pane: PaneId) => void;
  minimizePane: (pane: DockablePane) => void;
  expandMinimized: (pane: DockablePane) => void;
  closePane: (pane: PaneId) => void;
  startPaneDrag: (pane: DockablePane) => void;
  updateSnapTarget: (zone: SnapZone | null) => void;
  endPaneDrag: (apply: boolean) => void;
  applySnap: (pane: DockablePane, zone: SnapZone) => void;
  /** Show documentation pane and optionally focus a topic opener callback side-effect */
  revealDocumentation: () => void;
  revealOutput: () => void;
};

type PersistedLayout = {
  sidebarVisible: boolean;
  terminalVisible: boolean;
  documentationVisible: boolean;
  outputVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  docsPosition: PanelPosition;
  outputPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
    documentation: boolean;
    output: boolean;
  };
};

const STORAGE_KEY = "jabl-layout";

const DEFAULT_LAYOUT: PersistedLayout = {
  sidebarVisible: true,
  terminalVisible: true,
  documentationVisible: false,
  outputVisible: false,
  sidebarSide: "left",
  panelPosition: "bottom",
  docsPosition: "right",
  outputPosition: "bottom",
  maximized: null,
  minimized: {
    explorer: false,
    terminal: false,
    documentation: false,
    output: false,
  },
};

function isPaneId(v: unknown): v is PaneId {
  return (
    v === "explorer" ||
    v === "editor" ||
    v === "terminal" ||
    v === "documentation" ||
    v === "output"
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
      terminalVisible: parsed.terminalVisible ?? true,
      documentationVisible: parsed.documentationVisible ?? false,
      outputVisible: parsed.outputVisible ?? false,
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
      maximized: isPaneId(parsed.maximized) ? parsed.maximized : null,
      minimized: {
        explorer: !!parsed.minimized?.explorer,
        terminal: !!parsed.minimized?.terminal,
        documentation: !!parsed.minimized?.documentation,
        output: !!parsed.minimized?.output,
      },
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

function persist(state: LayoutState) {
  if (typeof window === "undefined") return;
  const data: PersistedLayout = {
    sidebarVisible: state.sidebarVisible,
    terminalVisible: state.terminalVisible,
    documentationVisible: state.documentationVisible,
    outputVisible: state.outputVisible,
    sidebarSide: state.sidebarSide,
    panelPosition: state.panelPosition,
    docsPosition: state.docsPosition,
    outputPosition: state.outputPosition,
    maximized: state.maximized,
    minimized: state.minimized,
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

function visibilityPatchForMinimize(
  pane: DockablePane
): Partial<LayoutState> {
  if (pane === "explorer") return { sidebarVisible: true };
  if (pane === "terminal") return { terminalVisible: true };
  if (pane === "documentation") return { documentationVisible: true };
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
    set((s) => {
      const next = {
        ...s,
        maximized: s.maximized === pane ? null : s.maximized,
        minimized: { ...s.minimized, [pane]: true },
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
      };
      persist(next);
      return next;
    });
  },

  closePane: (pane) => {
    if (pane === "editor") return;
    set((s) => {
      let next: LayoutState = s;
      if (pane === "explorer") {
        next = {
          ...s,
          sidebarVisible: false,
          maximized: s.maximized === "explorer" ? null : s.maximized,
          minimized: { ...s.minimized, explorer: false },
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
