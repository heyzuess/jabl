"use client";

import { create } from "zustand";
import { languageIdForPath } from "@/lib/abl/register";
import { languageForFilename } from "@/lib/abl/templates";
import {
  createDirectoryInHandle,
  findNode,
  insertOrReplaceChildNode,
  insertOrReplaceFileNode,
  isLocalPath,
  isTextFile,
  isUntitledPath,
  listDirectory,
  normalizePath,
  parentDirPath,
  pickDirectory,
  pickOpenFiles,
  readAttachedFile,
  readFileHandle,
  remapPathPrefix,
  removeChildNode,
  removeEntryFromDirectory,
  renameHandle,
  renameNodeInTree,
  resolveDirectoryHandle,
  downloadTextFile,
  saveTextFileLocally,
  supportsDirectoryPicker,
  supportsOpenFilePicker,
  treeFromFileList,
  walkDirectory,
  writeFileHandle,
  writeFileInDirectory,
} from "./fs-access";
import {
  generateCatalogArtifacts,
  mergeAnnotationsIntoMapping,
  parseRestAnnotations,
  parseServiceMapping,
} from "@/lib/rest";
import { useEditorLayoutStore } from "./editor-layout-store";
import type { FileNode, FsMode, OpenTab } from "./types";

function editorLayout() {
  return useEditorLayoutStore.getState();
}

export type CreateUntitledInput = {
  name: string;
  content: string;
  language?: string;
  /** Preferred directory for a later Save (when not written immediately). */
  targetDir?: string;
};

export type CreateNewFileInput = {
  name: string;
  content: string;
  language?: string;
  /** Directory under the open folder to create in (defaults to cwd). */
  dirPath?: string;
  /** External folder from showDirectoryPicker — takes precedence over dirPath. */
  dirHandle?: FileSystemDirectoryHandle;
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
  /** Prefill directory in the New File dialog. */
  newFileDefaultDir: string;
  newFolderDialogOpen: boolean;
  newFolderDefaultDir: string;
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
  createNewFile: (input: CreateNewFileInput) => Promise<void>;
  createNewFolder: (parentDir: string, name: string) => Promise<void>;
  renameEntry: (path: string, newName: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  setActivePath: (path: string) => void;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  closeSavedTabs: () => void;
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
  openNewFileDialog: (dirPath?: string) => void;
  setNewFolderDialogOpen: (open: boolean) => void;
  openNewFolderDialog: (dirPath?: string) => void;
  injectTerminal: (cmd: string) => void;
  clearTerminalInject: () => void;
  requestSyntaxCheck: (
    focus?: { path: string; line: number; column: number } | null
  ) => void;
  clearSyntaxFocus: () => void;
  /** Generate classic REST catalog artifacts from service-mapping.json. */
  generateRestCatalog: (mappingPath?: string) => Promise<void>;
};

function uniqueChildName(
  parent: FileNode,
  baseName: string,
  kind: "file" | "directory"
): string {
  const used = new Set(
    (parent.children || [])
      .filter((c) => c.kind === kind)
      .map((c) => c.name.toLowerCase())
  );
  if (!used.has(baseName.toLowerCase())) return baseName;
  const dot = baseName.lastIndexOf(".");
  const stem = kind === "file" && dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = kind === "file" && dot > 0 ? baseName.slice(dot) : "";
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}

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

/**
 * Sample files grouped by type under public/samples/abl/.
 * Paths are relative to that directory (e.g. procedures/hello.p).
 */
const SAMPLE_MANIFEST: { folder: string; files: string[] }[] = [
  {
    folder: "procedures",
    files: [
      "hello.p",
      "procedure.p",
      "customer-query.p",
      "progress-json.p",
      "openedge-http.p",
    ],
  },
  {
    folder: "classes",
    files: [
      "Customer.cls",
      "MyClass.cls",
      "IMyInterface.cls",
      "MyEnum.cls",
      "MyAbstract.cls",
      "progress-lang.cls",
      "progress-collections.cls",
      "openedge-string.cls",
      "openedge-logging.cls",
    ],
  },
  {
    folder: "includes",
    files: ["utils.i"],
  },
  {
    folder: "schema",
    files: ["schema.df"],
  },
  {
    folder: "rest",
    files: [
      "README.md",
      "RestJson.i",
      "ApiBootstrap.cls",
      "pasoe-handler-registration.md",
      "RestRouter.cls",
      "CustomersHandler.cls",
      "get-customer.p",
      "query-customers.p",
      "post-customer.p",
      "put-customer.p",
      "patch-customer.p",
      "delete-customer.p",
      "options-cors.p",
      "client-calls.p",
      "catalog-openapi-client.p",
      "openapi.yaml",
      "handlers.md",
      "PASOE-BRIDGE.md",
    ],
  },
  {
    folder: "rest/auth",
    files: [
      "README.md",
      "auth-filter.cls",
      "basic-auth.p",
      "basic-auth-handler.cls",
      "bearer-token.p",
      "oauth2-client-credentials.p",
      "oauth2-authorization-code.p",
    ],
  },
  {
    folder: "rest/doh",
    files: [
      "README.md",
      "customers.map",
      "customers.gen.notes.md",
      "CustomerEntity.cls",
      "doh-service-notes.md",
    ],
  },
  {
    folder: "rest/classic",
    files: [
      "README.md",
      "CustomerRest.cls",
      "get-customer-rest.p",
      "service-mapping.json",
      "rest-adapter-catalog.paar.md",
    ],
  },
  {
    folder: "rest/classic/expected",
    files: ["catalog.json", "resourceModel.xml"],
  },
];

function ensureSampleDir(root: FileNode, parts: string[]): FileNode {
  let node = root;
  let pathAcc = root.path;
  for (const part of parts) {
    pathAcc = `${pathAcc}/${part}`;
    let child = node.children?.find(
      (c) => c.name === part && c.kind === "directory"
    );
    if (!child) {
      child = {
        name: part,
        path: pathAcc,
        kind: "directory",
        children: [],
      };
      node.children = [...(node.children || []), child];
    }
    node = child;
  }
  return node;
}

async function loadSampleTree(): Promise<FileNode> {
  const root: FileNode = {
    name: "samples",
    path: "samples",
    kind: "directory",
    children: [],
  };
  for (const group of SAMPLE_MANIFEST) {
    const parts = group.folder.split("/").filter(Boolean);
    const dir = ensureSampleDir(root, parts);
    for (const name of group.files) {
      const res = await fetch(`/samples/abl/${group.folder}/${name}`);
      if (!res.ok) continue;
      const content = await res.text();
      const filePath = `samples/${group.folder}/${name}`;
      const existing = dir.children?.findIndex((c) => c.path === filePath) ?? -1;
      const fileNode: FileNode = {
        name,
        path: filePath,
        kind: "file",
        content,
      };
      if (existing >= 0 && dir.children) {
        dir.children = dir.children.map((c, i) =>
          i === existing ? fileNode : c
        );
      } else {
        dir.children = [...(dir.children || []), fileNode];
      }
    }
  }
  return root;
}

function upsertFileContent(
  root: FileNode | null,
  filePath: string,
  content: string
): FileNode | null {
  if (!root) return null;
  const parts = filePath.split("/").filter(Boolean);
  if (parts[0] !== root.name && filePath.startsWith(root.path + "/")) {
    // path like samples/rest/... when root.path is samples
  }
  const rel = filePath.startsWith(root.path + "/")
    ? filePath.slice(root.path.length + 1)
    : filePath.startsWith(root.name + "/")
      ? filePath.slice(root.name.length + 1)
      : null;
  if (rel == null) {
    return insertOrReplaceChildNode(root, filePath, {
      name: filePath.split("/").pop() || filePath,
      path: filePath,
      kind: "file",
      content,
    });
  }
  const name = rel.split("/").pop() || rel;
  return insertOrReplaceChildNode(root, filePath, {
    name,
    path: filePath,
    kind: "file",
    content,
  });
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
  newFileDefaultDir: "",
  newFolderDialogOpen: false,
  newFolderDefaultDir: "",
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
  openNewFileDialog: (dirPath) => {
    const { cwd, rootName } = get();
    set({
      newFileDialogOpen: true,
      newFileDefaultDir: dirPath || cwd || rootName || "",
    });
  },
  setNewFolderDialogOpen: (open) => set({ newFolderDialogOpen: open }),
  openNewFolderDialog: (dirPath) => {
    const { cwd, rootName } = get();
    set({
      newFolderDialogOpen: true,
      newFolderDefaultDir: dirPath || cwd || rootName || "",
    });
  },
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

  generateRestCatalog: async (mappingPath) => {
    const { root, buffers, openTabs, activePath } = get();
    const defaultPath = "samples/rest/classic/service-mapping.json";
    let path = mappingPath || "";
    if (!path && activePath) {
      if (activePath.endsWith("service-mapping.json")) path = activePath;
      else {
        const dir = parentDirPath(activePath);
        const sibling = `${dir}/service-mapping.json`;
        if (findNode(root, sibling) || buffers[sibling] != null) path = sibling;
      }
    }
    if (!path) path = defaultPath;

    const readText = async (p: string): Promise<string | null> => {
      if (buffers[p] != null) return buffers[p];
      const node = findNode(root, p);
      if (!node || node.kind !== "file") return null;
      try {
        return await readAttachedFile(node);
      } catch {
        return node.content ?? null;
      }
    };

    const mappingText = await readText(path);
    if (mappingText == null) {
      set({
        statusMessage: `REST catalog: mapping not found (${path}). Load Samples or open service-mapping.json.`,
      });
      return;
    }

    try {
      let mapping = parseServiceMapping(mappingText);
      const annPath = path.replace(/service-mapping\.json$/i, "CustomerRest.cls");
      const annText = await readText(annPath);
      if (annText) {
        mapping = mergeAnnotationsIntoMapping(
          mapping,
          parseRestAnnotations(annText, "samples.rest.classic.CustomerRest")
        );
      }
      const artifacts = generateCatalogArtifacts(mapping);
      const dir = parentDirPath(path) || "samples/rest/classic";
      const outputs: { name: string; content: string }[] = [
        { name: "catalog.json", content: artifacts.catalogJson },
        { name: "resourceModel.xml", content: artifacts.resourceModelXml },
        { name: "paar-sketch.md", content: artifacts.paarSketchMd },
      ];

      let nextRoot = root;
      let nextBuffers = { ...buffers };
      let nextTabs = [...openTabs];
      let lastPath: string | null = null;

      for (const out of outputs) {
        const outPath = `${dir}/${out.name}`;
        lastPath = outPath;
        nextBuffers[outPath] = out.content;
        if (nextRoot) {
          nextRoot = upsertFileContent(nextRoot, outPath, out.content);
        }
        const tabName = out.name;
        if (!nextTabs.some((t) => t.path === outPath)) {
          nextTabs.push({
            path: outPath,
            name: tabName,
            language: languageIdForPath(outPath),
          });
        }
        editorLayout().openInFocusedGroup(outPath);
      }

      if (!nextRoot) {
        for (const out of outputs) {
          downloadTextFile(out.name, out.content);
        }
      }

      set({
        root: nextRoot,
        buffers: nextBuffers,
        openTabs: nextTabs,
        activePath: lastPath,
        dirty: {
          ...get().dirty,
          ...Object.fromEntries(
            outputs.map((o) => [`${dir}/${o.name}`, true] as const)
          ),
        },
        statusMessage: nextRoot
          ? `REST catalog generated in ${dir} (catalog.json, resourceModel.xml, paar-sketch.md)`
          : `REST catalog downloaded (3 files). Open a folder or Samples to keep them in the workspace.`,
      });
    } catch (err) {
      set({
        statusMessage: `REST catalog failed: ${(err as Error).message}`,
      });
    }
  },

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
      const hasRest = !!findNode(root, "samples/rest");
      set({
        mode: "samples",
        root,
        rootName: root.name,
        cwd: root.name,
        // Collapsed by default — user expands samples / type folders as needed
        expanded: new Set<string>(),
        openTabs: [],
        activePath: null,
        buffers: {},
        dirty: {},
        loading: false,
        statusMessage: hasRest
          ? "Samples loaded — REST needs PASOE WEB (not batch Run). See samples/rest/README.md"
          : "Sample ABL project loaded",
      });
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
    const restTip =
      path.includes("/rest/") || path.startsWith("samples/rest")
        ? " — REST samples need PASOE WEB (not batch Run)"
        : "";
    set({
      buffers: { ...get().buffers, [path]: content },
      openTabs: already ? openTabs : [...openTabs, tab],
      activePath: path,
      statusMessage: `Opened ${node.name}${restTip}`,
    });
    editorLayout().openInFocusedGroup(path);
  },

  createUntitledFile: ({ name, content, language, targetDir }) => {
    const { openTabs, cwd, rootName } = get();
    const path = uniqueUntitledPath(name, openTabs);
    const fileName = path.split("/").pop() || name || "untitled.p";
    const tab: OpenTab = {
      path,
      name: fileName,
      language: language || languageForFilename(fileName),
      unsaved: true,
    };
    const preferredDir = targetDir || cwd || rootName || "";
    set({
      buffers: { ...get().buffers, [path]: content },
      dirty: { ...get().dirty, [path]: false },
      openTabs: [...openTabs, tab],
      activePath: path,
      newFileDefaultDir: preferredDir,
      statusMessage: `Created ${fileName}`,
    });
    editorLayout().openInFocusedGroup(path);
  },

  createNewFile: async ({ name, content, language, dirPath, dirHandle }) => {
    const { root, rootName, cwd, mode, openTabs } = get();
    const fileName = (name.trim() || "untitled.p").replace(/^.*[/\\]/, "");

    // Browse-to-folder: write via an explicit directory handle (may be outside workspace).
    if (dirHandle) {
      try {
        let uniqueName = fileName;
        let n = 2;
        for (;;) {
          try {
            await dirHandle.getFileHandle(uniqueName);
            const dot = fileName.lastIndexOf(".");
            const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
            const ext = dot > 0 ? fileName.slice(dot) : "";
            uniqueName = `${stem}-${n}${ext}`;
            n += 1;
          } catch {
            break;
          }
        }
        const fileHandle = await writeFileInDirectory(
          dirHandle,
          uniqueName,
          content
        );
        const newPath = uniqueLocalPath(uniqueName, openTabs);
        const tab: OpenTab = {
          path: newPath,
          name: uniqueName,
          language: language || languageForFilename(uniqueName),
          fileHandle,
        };
        const already = openTabs.some((t) => t.path === newPath);
        set({
          buffers: { ...get().buffers, [newPath]: content },
          dirty: { ...get().dirty, [newPath]: false },
          openTabs: already ? openTabs : [...openTabs, tab],
          activePath: newPath,
          newFileDefaultDir: dirPath || dirHandle.name,
          statusMessage: `Created ${uniqueName} in ${dirHandle.name}`,
        });
        editorLayout().openInFocusedGroup(newPath);
        return;
      } catch (err) {
        set({
          statusMessage: `Create failed: ${(err as Error).message}`,
        });
        return;
      }
    }

    const parentPath = normalizePath(
      dirPath || cwd || rootName || "",
      rootName || "workspace"
    );

    if (!root || !rootName) {
      get().createUntitledFile({
        name: fileName,
        content,
        language,
        targetDir: dirPath,
      });
      return;
    }

    const parent = findNode(root, parentPath);
    if (!parent || parent.kind !== "directory") {
      get().createUntitledFile({
        name: fileName,
        content,
        language,
        targetDir: dirPath?.trim() || parentPath,
      });
      return;
    }

    const uniqueName = uniqueChildName(parent, fileName, "file");
    const newPath = `${parentPath}/${uniqueName}`;

    if (mode === "fs-access") {
      const dirHandle = resolveDirectoryHandle(root, parentPath);
      if (!dirHandle) {
        get().createUntitledFile({
          name: uniqueName,
          content,
          language,
          targetDir: parentPath,
        });
        return;
      }
      try {
        const fileHandle = await writeFileInDirectory(
          dirHandle,
          uniqueName,
          content
        );
        const fileNode: FileNode = {
          name: uniqueName,
          path: newPath,
          kind: "file",
          handle: fileHandle,
          content,
        };
        const nextRoot = insertOrReplaceChildNode(root, newPath, fileNode);
        const expanded = new Set(get().expanded);
        expanded.add(parentPath);
        const tab: OpenTab = {
          path: newPath,
          name: uniqueName,
          language: language || languageForFilename(uniqueName),
        };
        const already = openTabs.some((t) => t.path === newPath);
        set({
          root: nextRoot,
          expanded,
          buffers: { ...get().buffers, [newPath]: content },
          dirty: { ...get().dirty, [newPath]: false },
          openTabs: already ? openTabs : [...openTabs, tab],
          activePath: newPath,
          cwd: parentPath,
          statusMessage: `Created ${newPath}`,
        });
        editorLayout().openInFocusedGroup(newPath);
        return;
      } catch (err) {
        set({
          statusMessage: `Create failed: ${(err as Error).message}`,
        });
        return;
      }
    }

    // samples / readonly-input: in-memory tree entry
    const fileNode: FileNode = {
      name: uniqueName,
      path: newPath,
      kind: "file",
      content,
    };
    const nextRoot = insertOrReplaceChildNode(root, newPath, fileNode);
    const expanded = new Set(get().expanded);
    expanded.add(parentPath);
    const tab: OpenTab = {
      path: newPath,
      name: uniqueName,
      language: language || languageForFilename(uniqueName),
      unsaved: mode === "readonly-input",
    };
    set({
      root: nextRoot,
      expanded,
      buffers: { ...get().buffers, [newPath]: content },
      dirty: { ...get().dirty, [newPath]: false },
      openTabs: [...openTabs, tab],
      activePath: newPath,
      cwd: parentPath,
      statusMessage: `Created ${newPath}`,
    });
    editorLayout().openInFocusedGroup(newPath);
  },

  createNewFolder: async (parentDir, name) => {
    const { root, rootName, mode } = get();
    if (!root || !rootName) {
      set({ statusMessage: "Open a folder before creating a directory" });
      return;
    }
    const folderName = name.trim().replace(/[/\\]/g, "");
    if (!folderName) {
      set({ statusMessage: "Folder name required" });
      return;
    }
    const parentPath = normalizePath(parentDir || rootName, rootName);
    const parent = findNode(root, parentPath);
    if (!parent || parent.kind !== "directory") {
      set({ statusMessage: `Directory not found: ${parentPath}` });
      return;
    }
    const uniqueName = uniqueChildName(parent, folderName, "directory");
    const newPath = `${parentPath}/${uniqueName}`;

    if (mode === "fs-access") {
      const dirHandle = resolveDirectoryHandle(root, parentPath);
      if (!dirHandle) {
        set({ statusMessage: "Directory is not writable" });
        return;
      }
      try {
        const childHandle = await createDirectoryInHandle(dirHandle, uniqueName);
        const dirNode: FileNode = {
          name: uniqueName,
          path: newPath,
          kind: "directory",
          handle: childHandle,
          children: [],
        };
        const nextRoot = insertOrReplaceChildNode(root, newPath, dirNode);
        const expanded = new Set(get().expanded);
        expanded.add(parentPath);
        expanded.add(newPath);
        set({
          root: nextRoot,
          expanded,
          cwd: newPath,
          statusMessage: `Created folder ${newPath}`,
        });
        return;
      } catch (err) {
        set({
          statusMessage: `Create folder failed: ${(err as Error).message}`,
        });
        return;
      }
    }

    const dirNode: FileNode = {
      name: uniqueName,
      path: newPath,
      kind: "directory",
      children: [],
    };
    const nextRoot = insertOrReplaceChildNode(root, newPath, dirNode);
    const expanded = new Set(get().expanded);
    expanded.add(parentPath);
    expanded.add(newPath);
    set({
      root: nextRoot,
      expanded,
      cwd: newPath,
      statusMessage: `Created folder ${newPath}`,
    });
  },

  renameEntry: async (path, newName) => {
    const { root, rootName, mode, openTabs, buffers, dirty, expanded, cwd, activePath } =
      get();
    if (!root || !rootName) {
      set({ statusMessage: "No folder open" });
      return;
    }
    if (path === root.path || path === rootName) {
      set({ statusMessage: "Cannot rename the workspace root" });
      return;
    }
    const node = findNode(root, path);
    if (!node) {
      set({ statusMessage: `Not found: ${path}` });
      return;
    }
    const safeName = newName.trim().replace(/[/\\]/g, "");
    if (!safeName) {
      set({ statusMessage: "Name required" });
      return;
    }
    if (safeName === node.name) return;

    const parentPath = parentDirPath(path);
    const parent = findNode(root, parentPath);
    if (!parent || parent.kind !== "directory") {
      set({ statusMessage: "Parent directory not found" });
      return;
    }
    const conflict = (parent.children || []).some(
      (c) =>
        c.path !== path &&
        c.name.toLowerCase() === safeName.toLowerCase()
    );
    if (conflict) {
      set({ statusMessage: `Already exists: ${safeName}` });
      return;
    }

    const newPath = `${parentPath}/${safeName}`;

    if (mode === "fs-access") {
      if (!node.handle) {
        set({
          statusMessage: "Rename is not supported for this entry",
        });
        return;
      }
      try {
        await renameHandle(node.handle, safeName);
      } catch (err) {
        set({
          statusMessage: `Rename failed: ${(err as Error).message}`,
        });
        return;
      }
    }

    const nextRoot = renameNodeInTree(root, path, safeName);
    const nextExpanded = new Set(
      [...expanded].map((p) => remapPathPrefix(p, path, newPath))
    );
    const nextBuffers: Record<string, string> = {};
    for (const [k, v] of Object.entries(buffers)) {
      nextBuffers[remapPathPrefix(k, path, newPath)] = v;
    }
    const nextDirty: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(dirty)) {
      nextDirty[remapPathPrefix(k, path, newPath)] = v;
    }
    const nextTabs = openTabs.map((t) => {
      const next = remapPathPrefix(t.path, path, newPath);
      if (next === t.path) return t;
      return {
        ...t,
        path: next,
        name: next.split("/").pop() || t.name,
        language: languageForFilename(next.split("/").pop() || t.name),
      };
    });
    editorLayout().remapPathPrefix(path, newPath);
    set({
      root: nextRoot,
      expanded: nextExpanded,
      buffers: nextBuffers,
      dirty: nextDirty,
      openTabs: nextTabs,
      cwd: remapPathPrefix(cwd, path, newPath),
      activePath: activePath
        ? remapPathPrefix(activePath, path, newPath)
        : null,
      statusMessage: `Renamed to ${safeName}`,
    });
  },

  deleteEntry: async (path) => {
    const { root, rootName, mode, openTabs, buffers, dirty, expanded, cwd, activePath } =
      get();
    if (!root || !rootName) {
      set({ statusMessage: "No folder open" });
      return;
    }
    if (path === root.path || path === rootName) {
      set({ statusMessage: "Cannot delete the workspace root" });
      return;
    }
    const node = findNode(root, path);
    if (!node) {
      set({ statusMessage: `Not found: ${path}` });
      return;
    }

    const parentPath = parentDirPath(path);
    if (mode === "fs-access") {
      const parentHandle = resolveDirectoryHandle(root, parentPath);
      if (!parentHandle) {
        set({ statusMessage: "Parent directory is not writable" });
        return;
      }
      try {
        await removeEntryFromDirectory(
          parentHandle,
          node.name,
          node.kind === "directory"
        );
      } catch (err) {
        set({
          statusMessage: `Delete failed: ${(err as Error).message}`,
        });
        return;
      }
    }

    const matches = (p: string) => p === path || p.startsWith(`${path}/`);
    const nextRoot = removeChildNode(root, path);
    const nextExpanded = new Set([...expanded].filter((p) => !matches(p)));
    const nextBuffers = { ...buffers };
    const nextDirty = { ...dirty };
    for (const key of Object.keys(nextBuffers)) {
      if (matches(key)) delete nextBuffers[key];
    }
    for (const key of Object.keys(nextDirty)) {
      if (matches(key)) delete nextDirty[key];
    }
    const nextTabs = openTabs.filter((t) => !matches(t.path));
    editorLayout().closePathsUnder(path);

    let nextActive = activePath && matches(activePath) ? null : activePath;
    if (!nextActive && nextTabs.length) {
      nextActive = nextTabs[nextTabs.length - 1].path;
    }
    const nextCwd =
      cwd && matches(cwd) ? parentPath || rootName : cwd;

    set({
      root: nextRoot,
      expanded: nextExpanded,
      buffers: nextBuffers,
      dirty: nextDirty,
      openTabs: nextTabs,
      activePath: nextActive,
      cwd: nextCwd,
      statusMessage: `Deleted ${node.name}`,
    });
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

  closeAllTabs: () => {
    editorLayout().retainPaths([]);
    set({
      openTabs: [],
      activePath: null,
      buffers: {},
      dirty: {},
    });
  },

  closeSavedTabs: () => {
    const { openTabs, activePath, buffers, dirty } = get();
    const keep = openTabs.filter(
      (t) => dirty[t.path] || t.unsaved || isUntitledPath(t.path)
    );
    const keepPaths = new Set(keep.map((t) => t.path));
    const nextBuffers: Record<string, string> = {};
    const nextDirty: Record<string, boolean> = {};
    for (const path of keepPaths) {
      if (path in buffers) nextBuffers[path] = buffers[path];
      if (dirty[path]) nextDirty[path] = true;
    }
    editorLayout().retainPaths([...keepPaths]);
    const focused = editorLayout().getFocusedGroup();
    let nextActive = focused.activePath;
    if (!nextActive || !keepPaths.has(nextActive)) {
      nextActive =
        activePath && keepPaths.has(activePath)
          ? activePath
          : keep.length
            ? keep[keep.length - 1].path
            : null;
    }
    set({
      openTabs: keep,
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
    // Keep ABL symbol index in sync for completions / hover (lazy import avoids cycles)
    if (/\.(p|w|i|cls|abl)$/i.test(path)) {
      void import("@/lib/abl/workspace-index").then(({ noteBufferChange }) => {
        noteBufferChange(path, value);
      });
    }
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
          defaultDir: get().newFileDefaultDir || cwd || rootName,
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
