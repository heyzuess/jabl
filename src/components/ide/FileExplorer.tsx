"use client";

import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAblFile } from "@/lib/abl/keywords";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import type { FileNode } from "@/lib/workspace/types";
import { PaneChrome } from "./PaneChrome";

function TreeNode({
  node,
  depth,
}: {
  node: FileNode;
  depth: number;
}) {
  const isOpen = useWorkspaceStore((s) => s.expanded.has(node.path));
  const toggleExpanded = useWorkspaceStore((s) => s.toggleExpanded);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const isActive = useWorkspaceStore((s) => s.activePath === node.path);
  const isDirty = useWorkspaceStore((s) => !!s.dirty[node.path]);
  const abl = node.kind === "file" && isAblFile(node.name);

  if (node.kind === "directory") {
    return (
      <div>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent/60",
            "text-foreground"
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
          onClick={() => toggleExpanded(node.path)}
        >
          {isOpen ? (
            <ChevronDown className="size-3 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="size-3 shrink-0 opacity-70" />
          )}
          {isOpen ? (
            <FolderOpen className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen &&
          node.children?.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent/60",
        isActive && "bg-accent text-accent-foreground",
        abl && !isActive && "text-[var(--ide-keyword)]"
      )}
      style={{ paddingLeft: 4 + depth * 12 + 14 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void openFile(node.path);
      }}
    >
      <FileCode2
        className={cn(
          "size-3.5 shrink-0",
          abl ? "text-[var(--ide-keyword)]" : "opacity-60"
        )}
      />
      <span className="truncate">
        {node.name}
        {isDirty ? " *" : ""}
      </span>
    </button>
  );
}

export function FileExplorer() {
  const root = useWorkspaceStore((s) => s.root);
  const loading = useWorkspaceStore((s) => s.loading);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const explorerMinimized = useLayoutStore((s) => s.minimized.explorer);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="explorer"
        title="Explorer"
        actions={
          <button
            type="button"
            title="New File (Ctrl/Cmd+N)"
            aria-label="New File"
            className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent"
            onClick={() => openNewFileDialog()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <FilePlus className="size-3.5" />
          </button>
        }
      />
      {!explorerMinimized && (
        <div className="min-h-0 flex-1 overflow-y-auto p-1 pb-4">
          {loading && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
          )}
          {!loading && !root && (
            <div className="space-y-2 px-2 py-3 text-xs text-muted-foreground">
              <p>No folder open.</p>
              <p>
                Use <span className="text-foreground">New File</span>,{" "}
                <span className="text-foreground">Open Folder</span>, or{" "}
                <span className="text-foreground">Samples</span>.
              </p>
            </div>
          )}
          {root && <TreeNode node={root} depth={0} />}
        </div>
      )}
    </div>
  );
}
