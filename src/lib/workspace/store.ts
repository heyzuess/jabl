"use client";

import { create } from "zustand";
import { languageIdForPath } from "@/lib/abl/register";
import { languageForFilename } from "@/lib/abl/templates";
import {
  findNode,
  insertOrReplaceFileNode,
  isLocalPath,
  isTextFile,
  isUntitledPath,
  listDirectory,
  normalizePath,
  pickDirectory,
  pickOpenFiles,
  readAttachedFile,
  readFileHandle,
  resolveDirectoryHandle,
  saveTextFileLocally,
  supportsDirectoryPicker,
  supportsOpenFilePicker,
  treeFromFileList,
  walkDirectory,
  writeFileHandle,
  writeFileInDirectory,
} from "./fs-access";
import { useEditorLayoutStore } from "./editor-layout-store";
import type { FileNode, FsMode, OpenTab } from "./types";

function editorLayout() {
  return useEditorLayoutStore.getState();
}

export type CreateUntitledInput = {
  name: string;
  content: string;
  language?: string;
};

export type SaveFileDialogState = {
  open: boolean;
  path: string;
  suggestedName: string;
  defaultDir: string;
};

export type WorkspaceState = {
  mode: FsMode;
  root: FileNode | null;
  rootName: string;
  cwd: string;
  openTabs: OpenTab[];
  activePath: string | null;
  buffers: Record<string, string>;
  dirty: Record<string, boolean>;
  expanded: Set<string>;
  statusMessage: string | null;
  loading: boolean;
  newFileDialogOpen: boolean;
  saveFileDialog: SaveFileDialogState;
  /** Command line injected into the terminal (menu → CLI bridge). */
  terminalInject: string | null;
  /** Bumped to force an immediate syntax re-check in the editor. */
  syntaxCheckNonce: number;
  /** Optional focus target after check (1-based line/col). */
  syntaxFocus: { path: string; line: number; column: number } | null;

  openFolderViaPicker: () => Promise<void>;
  openFolderViaInput: (files: FileList) => Promise<void>;
  openLocalFileViaPicker: () => Promise<void>;
  openLocalFilesViaInput: (files: FileList) => Promise<void>;
  loadSamples: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  createUntitledFile: (input: CreateUntitledInput) => void;
  setActivePath: (path: string) => void;
  closeTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateBuffer: (path: string, value: string) => void;
  saveActive: () => Promise<void>;
  setSaveFileDialogOpen: (open: boolean) => void;
  saveActiveToDirectory: (dirPath: string, fileName: string) => Promise<void>;
  saveActiveToOtherLocation: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  setCwd: (path: string) => void;
  listAt: (path?: string) => FileNode[];
  readAt: (path: string) => Promise<string>;
  setStatus: (msg: string | null) => void;
  setNewFileDialogOpen: (open: boolean) => void;
  openNewFileDialog: () => void;
  injectTerminal: (cmd: string) => void;
  clearTerminalInject: () => void;
  requestSyntaxCheck: (
    focus?: { path: string; line: number; column: number } | null
  ) => void;
  clearSyntaxFocus: () => void;
};

/** Keep untitled/local tabs when swapping the workspace root. */
function preserveOutsideState(state: {
  openTabs: OpenTab[];
  buffers: Record<string, string>;
  dirty: Record<string, boolean>;
  activePath: string | null;
}): {
  openTabs: OpenTab[];
  buffers: Record<string, string>;
  dirty: Record<string, boolean>;
  activePath: string | null;
} {
  const openTabs = state.openTabs.filter(
    (t) => isUntitledPath(t.path) || isLocalPath(t.path) || t.unsaved
  );
  const keep = new Set(openTabs.map((t) => t.path));
  const buffers: Record<string, string> = {};
  const dirty: Record<string, boolean> = {};
  for (const path of keep) {
    if (state.buffers[path] != null) buffers[path] = state.buffers[path];
    if (state.dirty[path] != null) dirty[path] = state.dirty[path];
  }
  const activePath =
    state.activePath && keep.has(state.activePath)
      ? state.activePath
      : openTabs.length
        ? openTabs[openTabs.length - 1].path
        : null;
  return { openTabs, buffers, dirty, activePath };
}

function remapTabPath(
  openTabs: OpenTab[],
  buffers: Record<string, string>,
  dirty: Record<string, boolean>,
  oldPath: string,
  newPath: string,
  content: string,
  patch: Partial<OpenTab>
): {
  openTabs: OpenTab[];
  buffers: Record<string, string>;
  dirty: Record<string, boolean>;
} {
  const nextBuffers = { ...buffers };
  const nextDirty = { ...dirty };
  if (newPath !== oldPath) {
    nextBuffers[newPath] = content;
    delete nextBuffers[oldPath];
    delete nextDirty[oldPath];
  } else {
    nextBuffers[newPath] = content;
  }
  nextDirty[newPath] = false;
  const nextTabs = openTabs.map((t) =>
    t.path === oldPath
      ? {
          ...t,
          path: newPath,
          ...patch,
        }
      : t
  );
  return { openTabs: nextTabs, buffers: nextBuffers, dirty: nextDirty };
}

function uniqueUntitledPath(name: string, openTabs: OpenTab[]): string {
  const safe = name.trim() || "untitled.p";
  const base = safe.includes("/") ? safe.split("/").pop()! : safe;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";

  let candidate = `untitled/${base}`;
  let n = 1;
  const used = new Set(openTabs.map((t) => t.path));
  while (used.has(candidate)) {
    n += 1;
    candidate = `untitled/${stem}-${n}${ext}`;
  }
  return candidate;
}

function uniqueLocalPath(name: string, openTabs: OpenTab[]): string {
  const safe = name.trim() || "untitled.p";
  const base = safe.includes("/") ? safe.split("/").pop()! : safe;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";

  let candidate = `local/${base}`;
  let n = 1;
  const used = new Set(openTabs.map((t) => t.path));
  while (used.has(candidate)) {
    n += 1;
    candidate = `local/${stem}-${n}${ext}`;
  }
  return candidate;
}

const SAMPLE_MANIFEST = [
  "hello.p",
  "customer-query.p",
  "Customer.cls",
  "utils.i",
  "schema.df",
];

async function loadSampleTree(): Promise<FileNode> {
  const children: FileNode[] = [];
  for (const name of SAMPLE_MANIFEST) {
    const res = await fetch(`/samples/abl/${name}`);
    if (!res.ok) continue;
    const content = await res.text();
    children.push({
      name,
      path: `samples/${name}`,
      kind: "file",
      content,
    });
  }
  return {
    name: "samples",
    path: "samples",
    kind: "directory",
    children,
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  mode: "none",
  root: null,
  rootName: "",
  cwd: "",
  openTabs: [],
  activePath: null,
  buffers: {},
  dirty: {},
  expanded: new Set<string>(),
  statusMessage: null,
  loading: false,
  newFileDialogOpen: false,
  saveFileDialog: {
    open: false,
    path: "",
    suggestedName: "untitled.p",
    defaultDir: "",
  },
  terminalInject: null,
  syntaxCheckNonce: 0,
  syntaxFocus: null,

  setStatus: (msg) => set({ statusMessage: msg }),
  setNewFileDialogOpen: (open) => set({ newFileDialogOpen: open }),
  openNewFileDialog: () => set({ newFileDialogOpen: true }),
  setSaveFileDialogOpen: (open) =>
    set((s) => ({ saveFileDialog: { ...s.saveFileDialog, open } })),

  injectTerminal: (cmd) => set({ terminalInject: cmd }),
  clearTerminalInject: () => set({ terminalInject: null }),
  requestSyntaxCheck: (focus = null) =>
    set((s) => ({
      syntaxCheckNonce: s.syntaxCheckNonce + 1,
      syntaxFocus: focus,
    })),
  clearSyntaxFocus: () => set({ syntaxFocus: null }),

  openFolderViaPicker: async () => {
    if (!supportsDirectoryPicker()) {
      set({
        statusMessage:
          "File System Access API not available — use the fallback folder picker.",
      });
      return;
    }
    set({ loading: true, statusMessage: "Opening folder…" });
    try {
      const handle = await pickDirectory();
      if (!handle) {
        set({ loading: false, statusMessage: null });
        return;
      }
      const root = await walkDirectory(handle);
      const preserved = preserveOutsideState(get());
      editorLayout().retainPaths(preserved.openTabs.map((t) => t.path));
      set({
        mode: "fs-access",
        root,
        rootName: root.name,
        cwd: root.name,
        expanded: new Set([root.path]),
        ...preserved,
        loading: false,
        statusMessage: `Opened ${root.name}`,
      });
    } catch (err) {
      set({
        loading: false,
        statusMessage: `Failed to open folder: ${(err as Error).message}`,
      });
    }
  },

  openFolderViaInput: async (files) => {
    set({ loading: true, statusMessage: "Loading folder…" });
    try {
      const root = treeFromFileList(files);
      // Preload text file contents into content field
      const preload = async (node: FileNode) => {
        if (node.kind === "file" && isTextFile(node.name)) {
          try {
            node.content = await readAttachedFile(node);
          } catch {
            node.content = "";
          }
        }
        if (node.children) {
          for (const c of node.children) await preload(c);
        }
      };
      await preload(root);
      const preserved = preserveOutsideState(get());
      editorLayout().retainPaths(preserved.openTabs.map((t) => t.path));
      set({
        mode: "readonly-input",
        root,
        rootName: root.name,
        cwd: root.name,
        expanded: new Set([root.path]),
        ...preserved,
        loading: false,
        statusMessage: `Opened ${root.name} (read-only — Save downloads the file)`,
      });
    } catch (err) {
      set({
        loading: false,
        statusMessage: `Failed to load folder: ${(err as Error).message}`,
      });
    }
  },

  openLocalFileViaPicker: async () => {
    if (!supportsOpenFilePicker()) {
      set({
        statusMessage:
          "File picker not available — use the fallback Open File control.",
      });
      return;
    }
    set({ statusMessage: "Opening file…" });
    try {
      const handles = await pickOpenFiles(true);
      if (!handles?.length) {
        set({ statusMessage: null });
        return;
      }

      let openTabs = [...get().openTabs];
      const buffers = { ...get().buffers };
      const dirty = { ...get().dirty };
      let lastPath: string | null = null;
      let opened = 0;

      for (const handle of handles) {
        const content = await readFileHandle(handle);
        const path = uniqueLocalPath(handle.name, openTabs);
        const tab: OpenTab = {
          path,
          name: handle.name,
          language: languageIdForPath(path),
          fileHandle: handle,
        };
        openTabs = [...openTabs, tab];
        buffers[path] = content;
        dirty[path] = false;
        lastPath = path;
        opened += 1;
      }

      set({
        openTabs,
        buffers,
        dirty,
        activePath: lastPath,
        statusMessage:
          opened === 1
            ? `Opened ${openTabs[openTabs.length - 1]?.name}`
            : `Opened ${opened} files`,
      });
      for (const tab of openTabs.slice(-opened)) {
        editorLayout().openInFocusedGroup(tab.path);
      }
    } catch (err) {
      set({
        statusMessage: `Failed to open file: ${(err as Error).message}`,
      });
    }
  },

  openLocalFilesViaInput: async (files) => {
    if (!files.length) return;
    set({ statusMessage: "Opening file…" });
    try {
      let openTabs = [...get().openTabs];
      const buffers = { ...get().buffers };
      const dirty = { ...get().dirty };
      let lastPath: string | null = null;
      let opened = 0;

      for (const file of Array.from(files)) {
        const content = await file.text();
        const path = uniqueLocalPath(file.name, openTabs);
        const tab: OpenTab = {
          path,
          name: file.name,
          language: languageIdForPath(path),
        };
        openTabs = [...openTabs, tab];
        buffers[path] = content;
        dirty[path] = false;
        lastPath = path;
        opened += 1;
      }

      set({
        openTabs,
        buffers,
        dirty,
        activePath: lastPath,
        statusMessage:
          opened === 1
            ? `Opened ${openTabs[openTabs.length - 1]?.name}`
            : `Opened ${opened} files`,
      });
      for (const tab of openTabs.slice(-opened)) {
        editorLayout().openInFocusedGroup(tab.path);
      }
    } catch (err) {
      set({
        statusMessage: `Failed to open file: ${(err as Error).message}`,
      });
    }
  },

  loadSamples: async () => {
    set({ loading: true, statusMessage: "Loading sample ABL project…" });
    try {
      const root = await loadSampleTree();
      editorLayout().resetLayout();
      set({
        mode: "samples",
        root,
        rootName: root.name,
        cwd: root.name,
        expanded: new Set([root.path]),
        openTabs: [],
        activePath: null,
        buffers: {},
        dirty: {},
        loading: false,
        statusMessage: "Sample ABL project loaded",
      });
      const first = root.children?.find((c) => c.name === "hello.p");
      if (first) await get().openFile(first.path);
    } catch (err) {
      set({
        loading: false,
        statusMessage: `Failed to load samples: ${(err as Error).message}`,
      });
    }
  },

  openFile: async (path) => {
    const { root, buffers, openTabs } = get();
    const node = findNode(root, path);
    if (!node || node.kind !== "file") {
      set({ statusMessage: `File not found: ${path}` });
      return;
    }

    let content = buffers[path];
    if (content == null) {
      try {
        content = await readAttachedFile(node);
      } catch (err) {
        set({
          statusMessage: `Cannot open ${path}: ${(err as Error).message}`,
        });
        return;
      }
    }

    const tab: OpenTab = {
      path,
      name: node.name,
      language: languageIdForPath(path),
    };
    const already = openTabs.some((t) => t.path === path);
    set({
      buffers: { ...get().buffers, [path]: content },
      openTabs: already ? openTabs : [...openTabs, tab],
      activePath: path,
      statusMessage: `Opened ${node.name}`,
    });
    editorLayout().openInFocusedGroup(path);
  },

  createUntitledFile: ({ name, content, language }) => {
    const { openTabs } = get();
    const path = uniqueUntitledPath(name, openTabs);
    const fileName = path.split("/").pop() || name || "untitled.p";
    const tab: OpenTab = {
      path,
      name: fileName,
      language: language || languageForFilename(fileName),
      unsaved: true,
    };
    set({
      buffers: { ...get().buffers, [path]: content },
      dirty: { ...get().dirty, [path]: false },
      openTabs: [...openTabs, tab],
      activePath: path,
      statusMessage: `Created ${fileName}`,
    });
    editorLayout().openInFocusedGroup(path);
  },

  setActivePath: (path) => {
    set({ activePath: path });
    editorLayout().revealPath(path);
  },

  closeTab: (path) => {
    const { openTabs, activePath, buffers, dirty } = get();
    const nextTabs = openTabs.filter((t) => t.path !== path);
    const nextBuffers = { ...buffers };
    const nextDirty = { ...dirty };
    delete nextBuffers[path];
    delete nextDirty[path];
    editorLayout().closeTabInGroups(path);
    const focused = editorLayout().getFocusedGroup();
    let nextActive = focused.activePath;
    if (!nextActive || nextActive === path) {
      nextActive =
        activePath === path
          ? nextTabs.length
            ? nextTabs[nextTabs.length - 1].path
            : null
          : activePath;
    }
    set({
      openTabs: nextTabs,
      activePath: nextActive,
      buffers: nextBuffers,
      dirty: nextDirty,
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const focused = editorLayout().getFocusedGroup();
    editorLayout().reorderTabsInGroup(focused.id, fromIndex, toIndex);
    // Keep global openTabs order loosely in sync with focused group
    const { openTabs } = get();
    const groupPaths = editorLayout().groups[focused.id]?.tabPaths ?? [];
    const inGroup = new Set(groupPaths);
    const rest = openTabs.filter((t) => !inGroup.has(t.path));
    const ordered = [
      ...groupPaths
        .map((p) => openTabs.find((t) => t.path === p))
        .filter((t): t is OpenTab => !!t),
      ...rest,
    ];
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= openTabs.length ||
      toIndex >= openTabs.length
    ) {
      set({ openTabs: ordered });
      return;
    }
    set({ openTabs: ordered });
  },

  updateBuffer: (path, value) => {
    set({
      buffers: { ...get().buffers, [path]: value },
      dirty: { ...get().dirty, [path]: true },
    });
  },

  saveActive: async () => {
    const { activePath, buffers, root, mode, dirty, openTabs, cwd, rootName } =
      get();
    if (!activePath) {
      set({ statusMessage: "No file open to save" });
      return;
    }
    const content = buffers[activePath] ?? "";
    const tab = openTabs.find((t) => t.path === activePath);
    const node = findNode(root, activePath);

    // Bound handle from a previous Save File Picker
    if (tab?.fileHandle && !tab.unsaved && !isUntitledPath(activePath)) {
      try {
        await writeFileHandle(tab.fileHandle, content);
        set({
          dirty: { ...dirty, [activePath]: false },
          openTabs: openTabs.map((t) =>
            t.path === activePath ? { ...t, unsaved: false } : t
          ),
          statusMessage: `Saved ${tab.name}`,
        });
      } catch (err) {
        set({
          statusMessage: `Save failed: ${(err as Error).message}`,
        });
      }
      return;
    }

    // Folder file with FS Access handle
    if (
      !tab?.unsaved &&
      !isUntitledPath(activePath) &&
      !isLocalPath(activePath) &&
      mode === "fs-access" &&
      node?.handle &&
      node.kind === "file"
    ) {
      try {
        await writeFileHandle(
          node.handle as FileSystemFileHandle,
          content
        );
        set({
          dirty: { ...dirty, [activePath]: false },
          statusMessage: `Saved ${activePath}`,
        });
      } catch (err) {
        set({
          statusMessage: `Save failed: ${(err as Error).message}`,
        });
      }
      return;
    }

    const suggested =
      tab?.name || node?.name || activePath.split("/").pop() || "untitled.p";

    // New/unsaved or outside file: choose directory inside open folder
    if (
      mode === "fs-access" &&
      root &&
      (tab?.unsaved ||
        isUntitledPath(activePath) ||
        isLocalPath(activePath) ||
        !node)
    ) {
      set({
        saveFileDialog: {
          open: true,
          path: activePath,
          suggestedName: suggested,
          defaultDir: cwd || rootName,
        },
      });
      return;
    }

    // Samples / readonly / no workspace: picker or download
    try {
      const result = await saveTextFileLocally(suggested, content);
      if (!result) {
        set({ statusMessage: "Save cancelled" });
        return;
      }

      const oldPath = activePath;
      const newName = result.name;
      const newPath =
        tab?.unsaved || isUntitledPath(oldPath)
          ? `local/${newName}`
          : oldPath;

      const remapped = remapTabPath(
        get().openTabs,
        get().buffers,
        get().dirty,
        oldPath,
        newPath,
        content,
        {
          name: newName,
          language: languageForFilename(newName),
          unsaved: false,
          fileHandle: result.handle,
        }
      );

      set({
        ...remapped,
        activePath: newPath,
        statusMessage:
          result.method === "picker"
            ? `Saved ${newName}`
            : `Downloaded ${newName}`,
      });
      if (oldPath !== newPath) editorLayout().remapPath(oldPath, newPath);
      else editorLayout().openInFocusedGroup(newPath);
    } catch (err) {
      set({
        statusMessage: `Save failed: ${(err as Error).message}`,
      });
    }
  },

  saveActiveToDirectory: async (dirPath, fileName) => {
    const { root, mode, openTabs, buffers, dirty, expanded, saveFileDialog } =
      get();
    const activePath = saveFileDialog.path || get().activePath;
    if (!activePath) {
      set({ statusMessage: "No file open to save" });
      return;
    }
    if (mode !== "fs-access" || !root) {
      set({ statusMessage: "No writable folder open" });
      return;
    }
    const name = fileName.trim() || "untitled.p";
    const content = buffers[activePath] ?? "";
    const dirHandle = resolveDirectoryHandle(root, dirPath);
    if (!dirHandle) {
      set({
        statusMessage: `Cannot save: directory not writable (${dirPath})`,
      });
      return;
    }

    try {
      const fileHandle = await writeFileInDirectory(dirHandle, name, content);
      const newPath = `${normalizePath(dirPath, root.name)}/${name}`;
      const fileNode: FileNode = {
        name,
        path: newPath,
        kind: "file",
        handle: fileHandle,
        content,
      };
      const nextRoot = insertOrReplaceFileNode(root, newPath, fileNode);
      const remapped = remapTabPath(
        openTabs,
        buffers,
        dirty,
        activePath,
        newPath,
        content,
        {
          name,
          language: languageForFilename(name),
          unsaved: false,
          fileHandle,
        }
      );
      const nextExpanded = new Set(expanded);
      nextExpanded.add(normalizePath(dirPath, root.name));
      nextExpanded.add(root.path);

      set({
        root: nextRoot,
        ...remapped,
        activePath: newPath,
        expanded: nextExpanded,
        saveFileDialog: { ...saveFileDialog, open: false },
        statusMessage: `Saved ${newPath}`,
      });
      if (activePath !== newPath) editorLayout().remapPath(activePath, newPath);
      else editorLayout().openInFocusedGroup(newPath);
    } catch (err) {
      set({
        statusMessage: `Save failed: ${(err as Error).message}`,
      });
    }
  },

  saveActiveToOtherLocation: async () => {
    const { saveFileDialog, buffers, openTabs } = get();
    const activePath = saveFileDialog.path || get().activePath;
    if (!activePath) {
      set({ statusMessage: "No file open to save" });
      return;
    }
    const content = buffers[activePath] ?? "";
    const tab = openTabs.find((t) => t.path === activePath);
    const suggested =
      saveFileDialog.suggestedName ||
      tab?.name ||
      activePath.split("/").pop() ||
      "untitled.p";

    try {
      const result = await saveTextFileLocally(suggested, content);
      if (!result) {
        set({ statusMessage: "Save cancelled" });
        return;
      }
      const oldPath = activePath;
      const newName = result.name;
      const newPath = `local/${newName}`;
      const remapped = remapTabPath(
        get().openTabs,
        get().buffers,
        get().dirty,
        oldPath,
        newPath,
        content,
        {
          name: newName,
          language: languageForFilename(newName),
          unsaved: false,
          fileHandle: result.handle,
        }
      );
      set({
        ...remapped,
        activePath: newPath,
        saveFileDialog: { ...get().saveFileDialog, open: false },
        statusMessage:
          result.method === "picker"
            ? `Saved ${newName}`
            : `Downloaded ${newName}`,
      });
      if (oldPath !== newPath) editorLayout().remapPath(oldPath, newPath);
      else editorLayout().openInFocusedGroup(newPath);
    } catch (err) {
      set({
        statusMessage: `Save failed: ${(err as Error).message}`,
      });
    }
  },

  toggleExpanded: (path) => {
    const expanded = new Set(get().expanded);
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
    set({ expanded });
  },

  setCwd: (path) => {
    const { root, rootName } = get();
    if (!root) return;
    const normalized = normalizePath(path, rootName);
    const node = findNode(root, normalized);
    if (node?.kind === "directory") {
      set({ cwd: normalized });
    }
  },

  listAt: (path) => {
    const { root, cwd, rootName } = get();
    if (!root) return [];
    const target = path != null ? normalizePath(path, rootName) : cwd || rootName;
    return listDirectory(root, target);
  },

  readAt: async (path) => {
    const { root, rootName, buffers } = get();
    if (!root) throw new Error("No workspace open");
    const normalized = normalizePath(path, rootName);
    if (buffers[normalized] != null) return buffers[normalized];
    // Try relative to cwd
    const withCwd = normalizePath(
      path.includes("/") || path.startsWith(rootName)
        ? path
        : `${get().cwd}/${path}`,
      rootName
    );
    if (buffers[withCwd] != null) return buffers[withCwd];
    const node =
      findNode(root, normalized) || findNode(root, withCwd);
    if (!node || node.kind !== "file") {
      throw new Error(`File not found: ${path}`);
    }
    if (node.content != null) return node.content;
    if (node.handle) {
      return readFileHandle(node.handle as FileSystemFileHandle);
    }
    return readAttachedFile(node);
  },
}));
