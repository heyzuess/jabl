"use client";

import { create } from "zustand";

export type PaneId = "explorer" | "editor" | "terminal";
export type SidebarSide = "left" | "right";
export type PanelPosition = "bottom" | "right" | "left";
export type SnapZone =
  | "left"
  | "right"
  | "bottom"
  | "center-left"
  | "center-right";

export type LayoutState = {
  sidebarVisible: boolean;
  terminalVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
  };
  /** Ephemeral: which secondary pane chrome is being dragged for snap */
  draggingPane: Exclude<PaneId, "editor"> | null;
  snapTarget: SnapZone | null;

  toggleSidebar: () => void;
  toggleTerminal: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setTerminalVisible: (visible: boolean) => void;
  setSidebarSide: (side: SidebarSide) => void;
  setPanelPosition: (position: PanelPosition) => void;
  maximizePane: (pane: PaneId) => void;
  restoreLayout: () => void;
  toggleMaximize: (pane: PaneId) => void;
  minimizePane: (pane: Exclude<PaneId, "editor">) => void;
  expandMinimized: (pane: Exclude<PaneId, "editor">) => void;
  closePane: (pane: PaneId) => void;
  startPaneDrag: (pane: Exclude<PaneId, "editor">) => void;
  updateSnapTarget: (zone: SnapZone | null) => void;
  endPaneDrag: (apply: boolean) => void;
  applySnap: (pane: Exclude<PaneId, "editor">, zone: SnapZone) => void;
};

type PersistedLayout = {
  sidebarVisible: boolean;
  terminalVisible: boolean;
  sidebarSide: SidebarSide;
  panelPosition: PanelPosition;
  maximized: PaneId | null;
  minimized: {
    explorer: boolean;
    terminal: boolean;
  };
};

const STORAGE_KEY = "jabl-layout";

const DEFAULT_LAYOUT: PersistedLayout = {
  sidebarVisible: true,
  terminalVisible: true,
  sidebarSide: "left",
  panelPosition: "bottom",
  maximized: null,
  minimized: {
    explorer: false,
    terminal: false,
  },
};

function loadPersisted(): PersistedLayout {
  if (typeof window === "undefined") return { ...DEFAULT_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PersistedLayout>;
    return {
      sidebarVisible: parsed.sidebarVisible ?? true,
      terminalVisible: parsed.terminalVisible ?? true,
      sidebarSide: parsed.sidebarSide === "right" ? "right" : "left",
      panelPosition:
        parsed.panelPosition === "left" || parsed.panelPosition === "right"
          ? parsed.panelPosition
          : "bottom",
      maximized:
        parsed.maximized === "explorer" ||
        parsed.maximized === "editor" ||
        parsed.maximized === "terminal"
          ? parsed.maximized
          : null,
      minimized: {
        explorer: !!parsed.minimized?.explorer,
        terminal: !!parsed.minimized?.terminal,
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
    sidebarSide: state.sidebarSide,
    panelPosition: state.panelPosition,
    maximized: state.maximized,
    minimized: state.minimized,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function applySnapToState(
  state: LayoutState,
  pane: Exclude<PaneId, "editor">,
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
    // bottom: keep side, just ensure visible
    return {
      sidebarVisible: true,
      maximized: null,
      minimized: { ...state.minimized, explorer: false },
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

  maximizePane: (pane) => {
    set((s) => {
      const next = {
        ...s,
        maximized: pane,
        minimized: { explorer: false, terminal: false },
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
          s.maximized === pane
            ? s.minimized
            : { explorer: false, terminal: false },
      };
      persist(next);
      return next;
    });
  },

  minimizePane: (pane) => {
    if (pane === "explorer" || pane === "terminal") {
      set((s) => {
        const next = {
          ...s,
          maximized: s.maximized === pane ? null : s.maximized,
          minimized: { ...s.minimized, [pane]: true },
          ...(pane === "explorer"
            ? { sidebarVisible: true }
            : { terminalVisible: true }),
        };
        persist(next);
        return next;
      });
    }
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
      const next =
        pane === "explorer"
          ? {
              ...s,
              sidebarVisible: false,
              maximized: s.maximized === "explorer" ? null : s.maximized,
              minimized: { ...s.minimized, explorer: false },
            }
          : {
              ...s,
              terminalVisible: false,
              maximized: s.maximized === "terminal" ? null : s.maximized,
              minimized: { ...s.minimized, terminal: false },
            };
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
