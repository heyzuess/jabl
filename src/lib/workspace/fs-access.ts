import type { FileNode } from "./types";

const TEXT_EXTENSIONS = new Set([
  ".p",
  ".w",
  ".i",
  ".cls",
  ".df",
  ".abl",
  ".txt",
  ".md",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".sql",
  ".csv",
  ".log",
  ".ini",
  ".cfg",
  ".properties",
]);

export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export function isTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return true;
  return TEXT_EXTENSIONS.has(lower.slice(dot));
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  try {
    return await window.showDirectoryPicker!({ mode: "readwrite" });
  } catch (err) {
    // User cancelled
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

export async function walkDirectory(
  handle: FileSystemDirectoryHandle,
  basePath = ""
): Promise<FileNode> {
  // Always prefix with the root folder name so child paths are unique and
  // consistent with normalizePath / findNode (e.g. myproject/src/a.p).
  const dirPath = basePath || handle.name;
  const children: FileNode[] = [];

  for await (const entry of handle.values()) {
    const path = `${dirPath}/${entry.name}`;
    if (entry.kind === "directory") {
      const dirHandle = entry as FileSystemDirectoryHandle;
      children.push(await walkDirectory(dirHandle, path));
    } else {
      children.push({
        name: entry.name,
        path,
        kind: "file",
        handle: entry as FileSystemFileHandle,
      });
    }
  }

  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return {
    name: handle.name,
    path: dirPath,
    kind: "directory",
    handle,
    children,
  };
}

export async function readFileHandle(
  handle: FileSystemFileHandle
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeFileHandle(
  handle: FileSystemFileHandle,
  contents: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

/** Build a tree from a FileList produced by <input webkitdirectory>. */
export function treeFromFileList(files: FileList): FileNode {
  const rootName = files[0]?.webkitRelativePath?.split("/")[0] || "folder";
  const root: FileNode = {
    name: rootName,
    path: rootName,
    kind: "directory",
    children: [],
  };

  const dirMap = new Map<string, FileNode>();
  dirMap.set(rootName, root);

  const ensureDir = (dirPath: string): FileNode => {
    const existing = dirMap.get(dirPath);
    if (existing) return existing;
    const parts = dirPath.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parent = ensureDir(parentPath || rootName);
    const node: FileNode = {
      name,
      path: dirPath,
      kind: "directory",
      children: [],
    };
    parent.children = parent.children || [];
    parent.children.push(node);
    dirMap.set(dirPath, node);
    return node;
  };

  Array.from(files).forEach((file) => {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split("/");
    const fileName = parts[parts.length - 1];
    const dirPath = parts.slice(0, -1).join("/");
    const parent = ensureDir(dirPath || rootName);
    parent.children = parent.children || [];
    parent.children.push({
      name: fileName,
      path: rel,
      kind: "file",
      content: undefined, // loaded lazily via FileReader in store
    });
  });

  // Attach File objects for later reading
  const fileByPath = new Map<string, File>();
  Array.from(files).forEach((f) => {
    fileByPath.set(f.webkitRelativePath || f.name, f);
  });

  const attach = (node: FileNode) => {
    if (node.kind === "file") {
      const f = fileByPath.get(node.path);
      if (f) {
        (node as FileNode & { _file?: File })._file = f;
      }
    } else {
      node.children?.forEach(attach);
      node.children?.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    }
  };
  attach(root);

  return root;
}

export async function readAttachedFile(node: FileNode): Promise<string> {
  const withFile = node as FileNode & { _file?: File };
  if (withFile._file) return withFile._file.text();
  if (node.content != null) return node.content;
  if (node.handle && node.kind === "file") {
    return readFileHandle(node.handle as FileSystemFileHandle);
  }
  throw new Error(`Cannot read file: ${node.path}`);
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function supportsSaveFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showSaveFilePicker === "function"
  );
}

export function supportsOpenFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showOpenFilePicker === "function"
  );
}

const ABL_OPEN_TYPES = [
  {
    description: "OpenEdge ABL",
    accept: {
      "text/plain": [".p", ".w", ".i", ".cls", ".df", ".abl", ".txt", ".md"],
    },
  },
];

/** Pick one or more local files via File System Access API. */
export async function pickOpenFiles(
  multiple = true
): Promise<FileSystemFileHandle[] | null> {
  if (!supportsOpenFilePicker()) return null;
  try {
    return await window.showOpenFilePicker!({
      multiple,
      types: ABL_OPEN_TYPES,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

export type LocalSaveResult = {
  name: string;
  handle?: FileSystemFileHandle;
  method: "picker" | "download";
};

/** Save text locally: File System Access picker when available, else download. */
export async function saveTextFileLocally(
  suggestedName: string,
  contents: string
): Promise<LocalSaveResult | null> {
  const name = suggestedName.trim() || "untitled.p";

  if (supportsSaveFilePicker()) {
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName: name,
        types: [
          {
            description: "OpenEdge ABL",
            accept: {
              "text/plain": [".p", ".w", ".i", ".cls", ".df", ".abl", ".txt"],
            },
          },
        ],
      });
      await writeFileHandle(handle, contents);
      return { name: handle.name || name, handle, method: "picker" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }
      throw err;
    }
  }

  downloadTextFile(name, contents);
  return { name, method: "download" };
}

export function findNode(
  root: FileNode | null,
  path: string
): FileNode | null {
  if (!root) return null;
  if (root.path === path) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  // Also try matching without root prefix
  if (path === root.name || path === ".") return root;
  return null;
}

export function listDirectory(
  root: FileNode | null,
  path: string
): FileNode[] {
  if (!root) return [];
  const normalized = normalizePath(path, root.name);
  const node = findNodeByRelPath(root, normalized);
  if (!node || node.kind !== "directory") return [];
  return node.children || [];
}

export function normalizePath(path: string, rootName: string): string {
  let p = path.trim() || ".";
  if (p === "." || p === "/" || p === "") return rootName;
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/")) p = p.slice(1);
  if (!p.startsWith(rootName)) {
    p = `${rootName}/${p}`;
  }
  return p.replace(/\/+/g, "/").replace(/\/$/, "");
}

function findNodeByRelPath(root: FileNode, path: string): FileNode | null {
  if (root.path === path || root.name === path) return root;
  const queue: FileNode[] = [root];
  while (queue.length) {
    const n = queue.shift()!;
    if (n.path === path) return n;
    if (n.children) queue.push(...n.children);
  }
  return null;
}

/** Resolve a directory node handle under the workspace root. */
export function resolveDirectoryHandle(
  root: FileNode | null,
  dirPath: string
): FileSystemDirectoryHandle | null {
  if (!root) return null;
  const normalized = normalizePath(dirPath, root.name);
  const node = findNode(root, normalized);
  if (!node || node.kind !== "directory") return null;
  return (node.handle as FileSystemDirectoryHandle | undefined) ?? null;
}

/** Create/overwrite a file under a directory handle and return the file handle. */
export async function writeFileInDirectory(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  contents: string
): Promise<FileSystemFileHandle> {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  await writeFileHandle(fileHandle, contents);
  return fileHandle;
}

function sortChildren(children: FileNode[]): void {
  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Insert or replace a child node under its parent path (immutable). */
export function insertOrReplaceChildNode(
  root: FileNode,
  childPath: string,
  childNode: FileNode
): FileNode {
  const parts = childPath.split("/");
  if (parts.length < 2) {
    const children = [...(root.children || [])];
    const idx = children.findIndex((c) => c.path === childPath);
    if (idx >= 0) children[idx] = childNode;
    else children.push(childNode);
    sortChildren(children);
    return { ...root, children };
  }

  const cloneDir = (node: FileNode, depth: number): FileNode => {
    const expectedPath = parts.slice(0, depth + 1).join("/");
    if (node.path !== expectedPath && !(depth === 0 && node.path === parts[0])) {
      return node;
    }
    if (depth === parts.length - 2) {
      const children = [...(node.children || [])];
      const idx = children.findIndex((c) => c.path === childPath);
      if (idx >= 0) children[idx] = childNode;
      else children.push(childNode);
      sortChildren(children);
      return { ...node, children };
    }
    const nextName = parts[depth + 1];
    const nextPath = parts.slice(0, depth + 2).join("/");
    const children = [...(node.children || [])];
    const childIdx = children.findIndex(
      (c) => c.kind === "directory" && (c.path === nextPath || c.name === nextName)
    );
    if (childIdx < 0) {
      const newDir: FileNode = {
        name: nextName,
        path: nextPath,
        kind: "directory",
        children: [],
      };
      children.push(cloneDir(newDir, depth + 1));
      sortChildren(children);
      return { ...node, children };
    }
    children[childIdx] = cloneDir(children[childIdx], depth + 1);
    return { ...node, children };
  };

  return cloneDir(root, 0);
}

/** @deprecated alias — prefer insertOrReplaceChildNode */
export function insertOrReplaceFileNode(
  root: FileNode,
  filePath: string,
  fileNode: FileNode
): FileNode {
  return insertOrReplaceChildNode(root, filePath, fileNode);
}

export async function createDirectoryInHandle(
  parentHandle: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return parentHandle.getDirectoryHandle(name, { create: true });
}

type RemovableDirectoryHandle = FileSystemDirectoryHandle & {
  removeEntry?: (
    name: string,
    options?: { recursive?: boolean }
  ) => Promise<void>;
};

type MovableHandle = (FileSystemFileHandle | FileSystemDirectoryHandle) & {
  move?: (name: string) => Promise<void>;
};

export async function removeEntryFromDirectory(
  parentHandle: FileSystemDirectoryHandle,
  name: string,
  recursive = false
): Promise<void> {
  const handle = parentHandle as RemovableDirectoryHandle;
  if (typeof handle.removeEntry !== "function") {
    throw new Error("This browser cannot delete workspace entries");
  }
  await handle.removeEntry(name, { recursive });
}

export async function renameHandle(
  handle: FileSystemFileHandle | FileSystemDirectoryHandle,
  newName: string
): Promise<void> {
  const movable = handle as MovableHandle;
  if (typeof movable.move !== "function") {
    throw new Error("This browser cannot rename workspace entries");
  }
  await movable.move(newName);
}

export function parentDirPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

export function remapPathPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string
): string {
  if (path === oldPrefix) return newPrefix;
  if (path.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${path.slice(oldPrefix.length)}`;
  }
  return path;
}

export function collectNodePaths(node: FileNode): string[] {
  if (node.kind === "file") return [node.path];
  const out = [node.path];
  for (const child of node.children || []) {
    out.push(...collectNodePaths(child));
  }
  return out;
}

function remapNodePaths(node: FileNode, oldPrefix: string, newPrefix: string): FileNode {
  const path = remapPathPrefix(node.path, oldPrefix, newPrefix);
  if (node.kind === "file") {
    return { ...node, path, name: path.split("/").pop() || node.name };
  }
  return {
    ...node,
    path,
    name: path.split("/").pop() || node.name,
    children: (node.children || []).map((c) =>
      remapNodePaths(c, oldPrefix, newPrefix)
    ),
  };
}

/** Remove a child node (file or directory) from the tree by path. */
export function removeChildNode(root: FileNode, targetPath: string): FileNode {
  if (root.path === targetPath) {
    throw new Error("Cannot remove the workspace root");
  }
  const parentPath = parentDirPath(targetPath);
  const strip = (node: FileNode): FileNode => {
    if (node.kind !== "directory") return node;
    if (node.path === parentPath) {
      return {
        ...node,
        children: (node.children || []).filter((c) => c.path !== targetPath),
      };
    }
    return {
      ...node,
      children: (node.children || []).map(strip),
    };
  };
  return strip(root);
}

/** Rename a node in the tree and rewrite descendant paths. */
export function renameNodeInTree(
  root: FileNode,
  oldPath: string,
  newName: string
): FileNode {
  if (root.path === oldPath) {
    throw new Error("Cannot rename the workspace root");
  }
  const safeName = newName.trim().replace(/[/\\]/g, "");
  if (!safeName) throw new Error("Name required");
  const parentPath = parentDirPath(oldPath);
  const newPath = `${parentPath}/${safeName}`;

  const renameAt = (node: FileNode): FileNode => {
    if (node.kind !== "directory") return node;
    if (node.path !== parentPath) {
      return { ...node, children: (node.children || []).map(renameAt) };
    }
    const children = (node.children || []).map((child) => {
      if (child.path !== oldPath) return child;
      return remapNodePaths(child, oldPath, newPath);
    });
    sortChildren(children);
    return { ...node, children };
  };

  return renameAt(root);
}

/** Collect all directory paths under root (including root). */
export function listDirectoryPaths(root: FileNode | null): string[] {
  if (!root) return [];
  const out: string[] = [];
  const walk = (node: FileNode) => {
    if (node.kind === "directory") {
      out.push(node.path);
      node.children?.forEach(walk);
    }
  };
  walk(root);
  return out;
}

export function isUntitledPath(path: string): boolean {
  return path.startsWith("untitled/");
}

export function isLocalPath(path: string): boolean {
  return path.startsWith("local/");
}

/** True when the tab is not part of the current workspace tree. */
export function isOutsideWorkspacePath(
  path: string,
  rootName: string
): boolean {
  if (isUntitledPath(path) || isLocalPath(path)) return true;
  if (!rootName) return true;
  return path !== rootName && !path.startsWith(`${rootName}/`);
}
