"use client";

import { create } from "zustand";

export const MAX_EDITOR_GROUPS = 9;

export type EditorGroupId = string;

export type EditorGroup = {
  id: EditorGroupId;
  tabPaths: string[];
  activePath: string | null;
};

export type SplitNode =
  | { type: "leaf"; groupId: EditorGroupId }
  | {
      type: "branch";
      orientation: "horizontal" | "vertical";
      children: SplitNode[];
      sizes: number[];
    };

export type SplitDirection = "right" | "down";

type EditorLayoutState = {
  root: SplitNode;
  groups: Record<EditorGroupId, EditorGroup>;
  focusedGroupId: EditorGroupId;

  focusGroup: (groupId: EditorGroupId) => void;
  getFocusedGroup: () => EditorGroup;
  leafCount: () => number;
  canSplit: () => boolean;

  /** Ensure path is in the focused group and activate it. */
  openInFocusedGroup: (path: string) => void;
  /** Activate path in whichever group already has it, else focused group. */
  revealPath: (path: string) => void;
  setGroupActivePath: (groupId: EditorGroupId, path: string) => void;
  closeTabInGroups: (path: string) => void;
  reorderTabsInGroup: (
    groupId: EditorGroupId,
    fromIndex: number,
    toIndex: number
  ) => void;
  moveTab: (
    path: string,
    fromGroupId: EditorGroupId,
    toGroupId: EditorGroupId,
    toIndex?: number
  ) => void;
  splitGroup: (
    groupId: EditorGroupId,
    direction: SplitDirection,
    options?: { moveActiveTab?: boolean }
  ) => EditorGroupId | null;
  splitFocused: (direction: SplitDirection) => EditorGroupId | null;
  closeGroup: (groupId: EditorGroupId) => void;
  setBranchSizes: (
    branchPath: number[],
    sizes: number[]
  ) => void;
  /** Remap a tab path after save rename. */
  remapPath: (oldPath: string, newPath: string) => void;
  /** Drop workspace-only tabs after folder swap; keep listed paths. */
  retainPaths: (paths: string[]) => void;
  resetLayout: () => void;
};

let groupSeq = 1;

function newGroupId(): EditorGroupId {
  groupSeq += 1;
  return `eg-${groupSeq}`;
}

function createGroup(
  id: EditorGroupId,
  tabPaths: string[] = [],
  activePath: string | null = null
): EditorGroup {
  return { id, tabPaths, activePath };
}

function initialState(): Pick<
  EditorLayoutState,
  "root" | "groups" | "focusedGroupId"
> {
  const id = "eg-1";
  groupSeq = 1;
  return {
    root: { type: "leaf", groupId: id },
    groups: { [id]: createGroup(id) },
    focusedGroupId: id,
  };
}

function countLeaves(node: SplitNode): number {
  if (node.type === "leaf") return 1;
  return node.children.reduce((n, c) => n + countLeaves(c), 0);
}

function collectGroupIds(node: SplitNode): EditorGroupId[] {
  if (node.type === "leaf") return [node.groupId];
  return node.children.flatMap(collectGroupIds);
}

function replaceLeafWithBranch(
  node: SplitNode,
  targetId: EditorGroupId,
  branch: Extract<SplitNode, { type: "branch" }>
): SplitNode {
  if (node.type === "leaf") {
    return node.groupId === targetId ? branch : node;
  }
  return {
    ...node,
    children: node.children.map((c) =>
      replaceLeafWithBranch(c, targetId, branch)
    ),
  };
}

function removeLeaf(
  node: SplitNode,
  targetId: EditorGroupId
): SplitNode | null {
  if (node.type === "leaf") {
    return node.groupId === targetId ? null : node;
  }
  const children = node.children
    .map((c) => removeLeaf(c, targetId))
    .filter((c): c is SplitNode => c != null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  const sizes =
    children.length === node.sizes.length
      ? node.sizes
      : children.map(() => 100 / children.length);
  return { ...node, children, sizes };
}

function updateBranchSizes(
  node: SplitNode,
  path: number[],
  sizes: number[]
): SplitNode {
  if (path.length === 0) {
    if (node.type !== "branch") return node;
    return { ...node, sizes };
  }
  if (node.type !== "branch") return node;
  const [head, ...rest] = path;
  const children = node.children.map((c, i) =>
    i === head ? updateBranchSizes(c, rest, sizes) : c
  );
  return { ...node, children };
}

function neighborGroupId(
  root: SplitNode,
  groupId: EditorGroupId
): EditorGroupId | null {
  const ids = collectGroupIds(root);
  const idx = ids.indexOf(groupId);
  if (idx < 0) return null;
  if (idx > 0) return ids[idx - 1];
  if (idx + 1 < ids.length) return ids[idx + 1];
  return null;
}

export const useEditorLayoutStore = create<EditorLayoutState>((set, get) => ({
  ...initialState(),

  focusGroup: (groupId) => {
    if (!get().groups[groupId]) return;
    set({ focusedGroupId: groupId });
  },

  getFocusedGroup: () => {
    const { groups, focusedGroupId } = get();
    return groups[focusedGroupId] ?? Object.values(groups)[0];
  },

  leafCount: () => countLeaves(get().root),

  canSplit: () => countLeaves(get().root) < MAX_EDITOR_GROUPS,

  openInFocusedGroup: (path) => {
    const { focusedGroupId, groups } = get();
    const group = groups[focusedGroupId];
    if (!group) return;
    const tabPaths = group.tabPaths.includes(path)
      ? group.tabPaths
      : [...group.tabPaths, path];
    set({
      groups: {
        ...groups,
        [focusedGroupId]: { ...group, tabPaths, activePath: path },
      },
      focusedGroupId,
    });
  },

  revealPath: (path) => {
    const { groups, focusedGroupId } = get();
    const owner = Object.values(groups).find((g) =>
      g.tabPaths.includes(path)
    );
    if (owner) {
      set({
        focusedGroupId: owner.id,
        groups: {
          ...groups,
          [owner.id]: { ...owner, activePath: path },
        },
      });
      return;
    }
    get().openInFocusedGroup(path);
    void focusedGroupId;
  },

  setGroupActivePath: (groupId, path) => {
    const group = get().groups[groupId];
    if (!group) return;
    set({
      focusedGroupId: groupId,
      groups: {
        ...get().groups,
        [groupId]: { ...group, activePath: path },
      },
    });
  },

  closeTabInGroups: (path) => {
    const groups = { ...get().groups };
    for (const id of Object.keys(groups)) {
      const g = groups[id];
      if (!g.tabPaths.includes(path)) continue;
      const tabPaths = g.tabPaths.filter((p) => p !== path);
      let activePath = g.activePath;
      if (activePath === path) {
        activePath = tabPaths.length
          ? tabPaths[tabPaths.length - 1]
          : null;
      }
      groups[id] = { ...g, tabPaths, activePath };
    }
    set({ groups });
  },

  reorderTabsInGroup: (groupId, fromIndex, toIndex) => {
    const group = get().groups[groupId];
    if (!group) return;
    const { tabPaths } = group;
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tabPaths.length ||
      toIndex >= tabPaths.length
    ) {
      return;
    }
    const next = [...tabPaths];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({
      groups: {
        ...get().groups,
        [groupId]: { ...group, tabPaths: next },
      },
    });
  },

  moveTab: (path, fromGroupId, toGroupId, toIndex) => {
    if (fromGroupId === toGroupId) {
      const group = get().groups[fromGroupId];
      if (!group) return;
      const fromIndex = group.tabPaths.indexOf(path);
      if (fromIndex < 0) return;
      const target =
        toIndex == null
          ? group.tabPaths.length - 1
          : Math.max(0, Math.min(toIndex, group.tabPaths.length - 1));
      get().reorderTabsInGroup(fromGroupId, fromIndex, target);
      return;
    }

    const groups = { ...get().groups };
    const from = groups[fromGroupId];
    const to = groups[toGroupId];
    if (!from || !to) return;
    if (!from.tabPaths.includes(path)) return;

    const fromTabs = from.tabPaths.filter((p) => p !== path);
    let fromActive = from.activePath;
    if (fromActive === path) {
      fromActive = fromTabs.length ? fromTabs[fromTabs.length - 1] : null;
    }
    groups[fromGroupId] = {
      ...from,
      tabPaths: fromTabs,
      activePath: fromActive,
    };

    const toTabs = to.tabPaths.filter((p) => p !== path);
    const insertAt =
      toIndex == null
        ? toTabs.length
        : Math.max(0, Math.min(toIndex, toTabs.length));
    toTabs.splice(insertAt, 0, path);
    groups[toGroupId] = {
      ...to,
      tabPaths: toTabs,
      activePath: path,
    };

    set({ groups, focusedGroupId: toGroupId });

    // Merge: close empty source group
    if (fromTabs.length === 0) {
      get().closeGroup(fromGroupId);
    }
  },

  splitGroup: (groupId, direction, options) => {
    const state = get();
    if (countLeaves(state.root) >= MAX_EDITOR_GROUPS) return null;
    const source = state.groups[groupId];
    if (!source) return null;

    const newId = newGroupId();
    let sourceTabs = [...source.tabPaths];
    let sourceActive = source.activePath;
    let newTabs: string[] = [];
    let newActive: string | null = null;

    if (options?.moveActiveTab && source.activePath) {
      const moving = source.activePath;
      sourceTabs = sourceTabs.filter((p) => p !== moving);
      sourceActive = sourceTabs.length
        ? sourceTabs[sourceTabs.length - 1]
        : null;
      newTabs = [moving];
      newActive = moving;
    }

    const orientation =
      direction === "right" ? "horizontal" : "vertical";
    const branch: Extract<SplitNode, { type: "branch" }> = {
      type: "branch",
      orientation,
      children: [
        { type: "leaf", groupId },
        { type: "leaf", groupId: newId },
      ],
      sizes: [50, 50],
    };

    set({
      root: replaceLeafWithBranch(state.root, groupId, branch),
      groups: {
        ...state.groups,
        [groupId]: {
          ...source,
          tabPaths: sourceTabs,
          activePath: sourceActive,
        },
        [newId]: createGroup(newId, newTabs, newActive),
      },
      focusedGroupId: newId,
    });
    return newId;
  },

  splitFocused: (direction) =>
    get().splitGroup(get().focusedGroupId, direction, {
      moveActiveTab: false,
    }),

  closeGroup: (groupId) => {
    const state = get();
    const ids = collectGroupIds(state.root);
    if (ids.length <= 1) return;

    const neighbor = neighborGroupId(state.root, groupId);
    const closing = state.groups[groupId];
    if (!closing) return;

    const groups = { ...state.groups };
    if (neighbor && groups[neighbor] && closing.tabPaths.length) {
      const target = groups[neighbor];
      const merged = [...target.tabPaths];
      for (const p of closing.tabPaths) {
        if (!merged.includes(p)) merged.push(p);
      }
      groups[neighbor] = {
        ...target,
        tabPaths: merged,
        activePath: closing.activePath ?? target.activePath,
      };
    }

    delete groups[groupId];
    const nextRoot = removeLeaf(state.root, groupId);
    if (!nextRoot) return;

    const remaining = collectGroupIds(nextRoot);
    const focusedGroupId = remaining.includes(state.focusedGroupId)
      ? state.focusedGroupId
      : neighbor && remaining.includes(neighbor)
        ? neighbor
        : remaining[0];

    set({
      root: nextRoot,
      groups,
      focusedGroupId,
    });
  },

  setBranchSizes: (branchPath, sizes) => {
    set({ root: updateBranchSizes(get().root, branchPath, sizes) });
  },

  remapPath: (oldPath, newPath) => {
    if (oldPath === newPath) return;
    const groups = { ...get().groups };
    for (const id of Object.keys(groups)) {
      const g = groups[id];
      if (!g.tabPaths.includes(oldPath) && g.activePath !== oldPath) continue;
      groups[id] = {
        ...g,
        tabPaths: g.tabPaths.map((p) => (p === oldPath ? newPath : p)),
        activePath: g.activePath === oldPath ? newPath : g.activePath,
      };
    }
    set({ groups });
  },

  retainPaths: (paths) => {
    const keep = new Set(paths);
    const groups = { ...get().groups };
    for (const id of Object.keys(groups)) {
      const g = groups[id];
      const tabPaths = g.tabPaths.filter((p) => keep.has(p));
      const activePath =
        g.activePath && keep.has(g.activePath)
          ? g.activePath
          : tabPaths.length
            ? tabPaths[tabPaths.length - 1]
            : null;
      groups[id] = { ...g, tabPaths, activePath };
    }
    set({ groups });
  },

  resetLayout: () => set(initialState()),
}));
