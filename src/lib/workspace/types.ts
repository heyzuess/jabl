export type FsMode = "none" | "fs-access" | "readonly-input" | "samples";

export type FileNode = {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileNode[];
  /** File System Access API handle when available */
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  /** In-memory content for samples / fallback input */
  content?: string;
};

export type OpenTab = {
  path: string;
  name: string;
  language: string;
  /** True when created via New File and not yet written to a durable handle */
  unsaved?: boolean;
  /** Writable handle after Save via showSaveFilePicker */
  fileHandle?: FileSystemFileHandle;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: {
        description?: string;
        accept: Record<string, string[]>;
      }[];
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: {
        description?: string;
        accept: Record<string, string[]>;
      }[];
    }) => Promise<FileSystemFileHandle>;
  }

  interface FileSystemHandle {
    readonly kind: "file" | "directory";
    readonly name: string;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: "file";
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: "directory";
    values(): AsyncIterableIterator<FileSystemHandle>;
    getFileHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemFileHandle>;
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle>;
    removeEntry(
      name: string,
      options?: { recursive?: boolean }
    ): Promise<void>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

export {};
