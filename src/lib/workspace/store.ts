"use client";

import { create } from "zustand";
import { languageIdForPath } from "@/lib/abl/register";
import { languageForFilename } from "@/lib/abl/templates";
import {
  findNode,
  isTextFile,
  listDirectory,
  normalizePath,
  pickDirectory,
  readAttachedFile,
  readFileHandle,
  saveTextFileLocally,
  supportsDirectoryPicker,
  treeFromFileList,
  walkDirectory,
  writeFileHandle,
} from "./fs-access";
import type { FileNode, FsMode, OpenTab } from "./types";

export type CreateUntitledInput = {
  name: string;
  content: string;
  language?: string;
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

  openFolderViaPicker: () => Promise<void>;
  openFolderViaInput: (files: FileList) => Promise<void>;
  loadSamples: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  createUntitledFile: (input: CreateUntitledInput) => void;
  setActivePath: (path: string) => void;
  closeTab: (path: string) => void;
  updateBuffer: (path: string, value: string) => void;
  saveActive: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  setCwd: (path: string) => void;
  listAt: (path?: string) => FileNode[];
  readAt: (path: string) => Promise<string>;
  setStatus: (msg: string | null) => void;
  setNewFileDialogOpen: (open: boolean) => void;
  openNewFileDialog: () => void;
};

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

  setStatus: (msg) => set({ statusMessage: msg }),
  setNewFileDialogOpen: (open) => set({ newFileDialogOpen: open }),
  openNewFileDialog: () => set({ newFileDialogOpen: true }),

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
      set({
        mode: "fs-access",
        root,
        rootName: root.name,
        cwd: root.name,
        expanded: new Set([root.path]),
        openTabs: [],
        activePath: null,
        buffers: {},
        dirty: {},
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
      set({
        mode: "readonly-input",
        root,
        rootName: root.name,
        cwd: root.name,
        expanded: new Set([root.path]),
        openTabs: [],
        activePath: null,
        buffers: {},
        dirty: {},
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

  loadSamples: async () => {
    set({ loading: true, statusMessage: "Loading sample ABL project…" });
    try {
      const root = await loadSampleTree();
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
  },

  setActivePath: (path) => set({ activePath: path }),

  closeTab: (path) => {
    const { openTabs, activePath, buffers, dirty } = get();
    const nextTabs = openTabs.filter((t) => t.path !== path);
    const nextBuffers = { ...buffers };
    const nextDirty = { ...dirty };
    delete nextBuffers[path];
    delete nextDirty[path];
    let nextActive = activePath;
    if (activePath === path) {
      nextActive = nextTabs.length ? nextTabs[nextTabs.length - 1].path : null;
    }
    set({
      openTabs: nextTabs,
      activePath: nextActive,
      buffers: nextBuffers,
      dirty: nextDirty,
    });
  },

  updateBuffer: (path, value) => {
    set({
      buffers: { ...get().buffers, [path]: value },
      dirty: { ...get().dirty, [path]: true },
    });
  },

  saveActive: async () => {
    const { activePath, buffers, root, mode, dirty, openTabs } = get();
    if (!activePath) {
      set({ statusMessage: "No file open to save" });
      return;
    }
    const content = buffers[activePath] ?? "";
    const tab = openTabs.find((t) => t.path === activePath);
    const node = findNode(root, activePath);

    // Bound handle from a previous Save File Picker
    if (tab?.fileHandle) {
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

    // Unsaved / samples / readonly: picker or download
    const suggested =
      tab?.name || node?.name || activePath.split("/").pop() || "untitled.p";
    try {
      const result = await saveTextFileLocally(suggested, content);
      if (!result) {
        set({ statusMessage: "Save cancelled" });
        return;
      }

      const oldPath = activePath;
      const newName = result.name;
      const newPath =
        tab?.unsaved || oldPath.startsWith("untitled/")
          ? `local/${newName}`
          : oldPath;

      const nextBuffers = { ...get().buffers };
      const nextDirty = { ...get().dirty };
      if (newPath !== oldPath) {
        nextBuffers[newPath] = content;
        delete nextBuffers[oldPath];
        delete nextDirty[oldPath];
      }
      nextDirty[newPath] = false;

      const nextTabs = get().openTabs.map((t) => {
        if (t.path !== oldPath) return t;
        return {
          ...t,
          path: newPath,
          name: newName,
          language: languageForFilename(newName),
          unsaved: false,
          fileHandle: result.handle ?? t.fileHandle,
        };
      });

      set({
        buffers: nextBuffers,
        dirty: nextDirty,
        openTabs: nextTabs,
        activePath: newPath,
        statusMessage:
          result.method === "picker"
            ? `Saved ${newName}`
            : `Downloaded ${newName}`,
      });
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
