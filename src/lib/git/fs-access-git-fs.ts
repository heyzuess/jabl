import type { PromiseFsClient } from "isomorphic-git";

export type BufferOverlay = {
  /** Map of workspace paths → buffer text for dirty/open files */
  getBuffer: (workspacePath: string) => string | undefined;
  /** True when the buffer should override disk for status */
  isDirty: (workspacePath: string) => boolean;
  rootName: string;
};

type FsError = Error & { code: string };

function fsError(code: string, message: string): FsError {
  const err = new Error(message) as FsError;
  err.code = code;
  return err;
}

function splitRel(path: string): string[] {
  const cleaned = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleaned || cleaned === ".") return [];
  return cleaned.split("/").filter((p) => p && p !== ".");
}

function joinRel(parts: string[]): string {
  return parts.join("/");
}

type StatLike = {
  type: "file" | "dir";
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  mode: number;
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
};

function makeStat(type: "file" | "dir", size: number, mtimeMs: number): StatLike {
  const mode = type === "dir" ? 0o40755 : 0o100644;
  return {
    type,
    size,
    mtimeMs,
    ctimeMs: mtimeMs,
    mode,
    isFile: () => type === "file",
    isDirectory: () => type === "dir",
    isSymbolicLink: () => false,
  };
}

async function resolveDir(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create = false
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part, create ? { create: true } : undefined);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TypeMismatchError") {
        throw fsError("ENOTDIR", `ENOTDIR: not a directory, '${joinRel(parts)}'`);
      }
      throw fsError("ENOENT", `ENOENT: no such file or directory, '${joinRel(parts)}'`);
    }
  }
  return dir;
}

async function resolveFile(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create = false
): Promise<FileSystemFileHandle> {
  if (parts.length === 0) {
    throw fsError("EISDIR", "EISDIR: illegal operation on a directory");
  }
  const filename = parts[parts.length - 1]!;
  const parent = await resolveDir(root, parts.slice(0, -1), create);
  try {
    return await parent.getFileHandle(filename, create ? { create: true } : undefined);
  } catch (err) {
    if (err instanceof DOMException && err.name === "TypeMismatchError") {
      throw fsError("EISDIR", `EISDIR: illegal operation on a directory, '${joinRel(parts)}'`);
    }
    throw fsError("ENOENT", `ENOENT: no such file or directory, '${joinRel(parts)}'`);
  }
}

function toBytes(data: string | Uint8Array | ArrayBuffer | DataView): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * PromiseFsClient backed by a File System Access directory handle.
 * Logical git `dir` is `/`; paths are relative to the opened folder.
 */
export function createFsAccessGitFs(
  rootHandle: FileSystemDirectoryHandle,
  overlay?: BufferOverlay | null
): PromiseFsClient {
  const workspacePathFor = (parts: string[]): string | null => {
    if (!overlay?.rootName) return null;
    if (parts.length === 0) return overlay.rootName;
    return `${overlay.rootName}/${joinRel(parts)}`;
  };

  const readOverlayBytes = (parts: string[]): Uint8Array | null => {
    if (!overlay) return null;
    const wp = workspacePathFor(parts);
    if (!wp || !overlay.isDirty(wp)) return null;
    const text = overlay.getBuffer(wp);
    if (text == null) return null;
    return new TextEncoder().encode(text);
  };

  const promises = {
    async readFile(
      path: string,
      options?: { encoding?: string } | string
    ): Promise<Uint8Array | string> {
      const parts = splitRel(path);
      const encoding =
        typeof options === "string" ? options : options?.encoding;

      const overlayBytes = readOverlayBytes(parts);
      if (overlayBytes) {
        return encoding ? new TextDecoder().decode(overlayBytes) : overlayBytes;
      }

      const handle = await resolveFile(rootHandle, parts);
      const file = await handle.getFile();
      const buf = new Uint8Array(await file.arrayBuffer());
      return encoding ? new TextDecoder().decode(buf) : buf;
    },

    async writeFile(
      path: string,
      data: string | Uint8Array | ArrayBuffer | DataView
    ): Promise<void> {
      const parts = splitRel(path);
      const handle = await resolveFile(rootHandle, parts, true);
      const bytes = toBytes(data);
      const chunk = new Uint8Array(bytes);
      const writable = await handle.createWritable();
      await writable.write(chunk);
      await writable.close();
    },

    async unlink(path: string): Promise<void> {
      const parts = splitRel(path);
      if (parts.length === 0) {
        throw fsError("EPERM", "EPERM: operation not permitted, unlink '/'");
      }
      const filename = parts[parts.length - 1]!;
      const parent = await resolveDir(rootHandle, parts.slice(0, -1));
      try {
        await parent.getFileHandle(filename);
      } catch (err) {
        if (err instanceof DOMException && err.name === "TypeMismatchError") {
          throw fsError("EPERM", `EPERM: operation not permitted, unlink '${path}'`);
        }
        throw fsError("ENOENT", `ENOENT: no such file or directory, unlink '${path}'`);
      }
      if (typeof parent.removeEntry !== "function") {
        throw fsError("EPERM", `EPERM: removeEntry not available, unlink '${path}'`);
      }
      await parent.removeEntry(filename);
    },

    async readdir(path: string): Promise<string[]> {
      const parts = splitRel(path);
      const dir = await resolveDir(rootHandle, parts);
      const names: string[] = [];
      for await (const entry of dir.values()) {
        names.push(entry.name);
      }
      return names;
    },

    async mkdir(path: string): Promise<void> {
      const parts = splitRel(path);
      if (parts.length === 0) {
        throw fsError("EEXIST", "EEXIST: file already exists, mkdir '/'");
      }
      const name = parts[parts.length - 1]!;
      const parent = await resolveDir(rootHandle, parts.slice(0, -1));
      try {
        await parent.getDirectoryHandle(name);
        throw fsError("EEXIST", `EEXIST: file already exists, mkdir '${path}'`);
      } catch (err) {
        if ((err as FsError).code === "EEXIST") throw err;
        if (err instanceof DOMException && err.name === "TypeMismatchError") {
          throw fsError("EEXIST", `EEXIST: file already exists, mkdir '${path}'`);
        }
      }
      await parent.getDirectoryHandle(name, { create: true });
    },

    async rmdir(path: string): Promise<void> {
      const parts = splitRel(path);
      if (parts.length === 0) {
        throw fsError("EINVAL", "EINVAL: invalid argument, rmdir '/'");
      }
      const name = parts[parts.length - 1]!;
      const parent = await resolveDir(rootHandle, parts.slice(0, -1));
      try {
        await parent.getDirectoryHandle(name);
      } catch (err) {
        if (err instanceof DOMException && err.name === "TypeMismatchError") {
          throw fsError("ENOTDIR", `ENOTDIR: not a directory, rmdir '${path}'`);
        }
        throw fsError("ENOENT", `ENOENT: no such file or directory, rmdir '${path}'`);
      }
      if (typeof parent.removeEntry !== "function") {
        throw fsError("EPERM", `EPERM: removeEntry not available, rmdir '${path}'`);
      }
      try {
        await parent.removeEntry(name);
      } catch {
        throw fsError("ENOTEMPTY", `ENOTEMPTY: directory not empty, rmdir '${path}'`);
      }
    },

    async stat(path: string): Promise<StatLike> {
      const parts = splitRel(path);
      if (parts.length === 0) {
        return makeStat("dir", 0, Date.now());
      }

      const overlayBytes = readOverlayBytes(parts);
      if (overlayBytes) {
        return makeStat("file", overlayBytes.byteLength, Date.now());
      }

      const parent = await resolveDir(rootHandle, parts.slice(0, -1));
      const name = parts[parts.length - 1]!;
      try {
        const fileHandle = await parent.getFileHandle(name);
        const file = await fileHandle.getFile();
        return makeStat("file", file.size, file.lastModified);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "TypeMismatchError")) {
          // try directory
        }
      }
      try {
        await parent.getDirectoryHandle(name);
        return makeStat("dir", 0, Date.now());
      } catch {
        throw fsError("ENOENT", `ENOENT: no such file or directory, stat '${path}'`);
      }
    },

    async lstat(path: string): Promise<StatLike> {
      return promises.stat(path);
    },

    async readlink(path: string): Promise<string> {
      throw fsError("EINVAL", `EINVAL: invalid argument, readlink '${path}'`);
    },

    async symlink(target: string, path: string): Promise<void> {
      throw fsError(
        "EPERM",
        `EPERM: operation not permitted, symlink '${target}' -> '${path}'`
      );
    },

    async chmod(path: string, mode: number): Promise<void> {
      void path;
      void mode;
    },
  };

  return { promises };
}

export async function hasGitDirectory(
  rootHandle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const handle = await rootHandle.getDirectoryHandle(".git");
    return handle.kind === "directory";
  } catch {
    try {
      await rootHandle.getFileHandle(".git");
      return true; // gitfile for worktrees/submodules
    } catch {
      return false;
    }
  }
}
