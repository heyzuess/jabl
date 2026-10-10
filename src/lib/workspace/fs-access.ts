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
  const children: FileNode[] = [];

  for await (const entry of handle.values()) {
    const path = basePath ? `${basePath}/${entry.name}` : entry.name;
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
    path: basePath || handle.name,
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
