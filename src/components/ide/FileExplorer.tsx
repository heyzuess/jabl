"use client";

import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAblFile } from "@/lib/abl/keywords";
import { isUntitledPath } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import type { FileNode, OpenTab } from "@/lib/workspace/types";
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
  const setCwd = useWorkspaceStore((s) => s.setCwd);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const openNewFolderDialog = useWorkspaceStore((s) => s.openNewFolderDialog);
  const isActive = useWorkspaceStore((s) => s.activePath === node.path);
  const isCwd = useWorkspaceStore((s) => s.cwd === node.path);
  const isDirty = useWorkspaceStore((s) => !!s.dirty[node.path]);
  const abl = node.kind === "file" && isAblFile(node.name);

  if (node.kind === "directory") {
    return (
      <div>
        <div
          className={cn(
            "group flex w-full items-center gap-0.5 rounded-sm pr-0.5 text-xs",
            isCwd && "bg-accent/40"
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left hover:bg-accent/60"
            onClick={() => {
              toggleExpanded(node.path);
              setCwd(node.path);
            }}
            title={node.path}
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
          <button
            type="button"
            title={`New file in ${node.name}`}
            aria-label={`New file in ${node.name}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setCwd(node.path);
              openNewFileDialog(node.path);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <FilePlus className="size-3" />
          </button>
          <button
            type="button"
            title={`New folder in ${node.name}`}
            aria-label={`New folder in ${node.name}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setCwd(node.path);
              openNewFolderDialog(node.path);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <FolderPlus className="size-3" />
          </button>
        </div>
        {isOpen &&
          (node.children ?? []).map((child) => (
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

function TabSection({
  title,
  tabs,
}: {
  title: string;
  tabs: OpenTab[];
}) {
  const setActivePath = useWorkspaceStore((s) => s.setActivePath);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const dirty = useWorkspaceStore((s) => s.dirty);

  if (tabs.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-2">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const abl = isAblFile(tab.name);
        return (
          <button
            key={tab.path}
            type="button"
            className={cn(
              "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent/60",
              active && "bg-accent text-accent-foreground",
              abl && !active && "text-[var(--ide-keyword)]"
            )}
            style={{ paddingLeft: 18 }}
            onClick={() => setActivePath(tab.path)}
            title={tab.path}
          >
            <FileCode2
              className={cn(
                "size-3.5 shrink-0",
                abl ? "text-[var(--ide-keyword)]" : "opacity-60"
              )}
            />
            <span className="truncate">
              {tab.name}
              {dirty[tab.path] ? " *" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FileExplorer() {
  const root = useWorkspaceStore((s) => s.root);
  const loading = useWorkspaceStore((s) => s.loading);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const openNewFolderDialog = useWorkspaceStore((s) => s.openNewFolderDialog);
  const explorerMinimized = useLayoutStore((s) => s.minimized.explorer);

  // Open files = every open tab that is not an unsaved new buffer
  // (workspace files + outside/local files).
  const openFileTabs = openTabs.filter(
    (t) => !t.unsaved && !isUntitledPath(t.path)
  );
  const unsavedTabs = openTabs.filter(
    (t) => t.unsaved || isUntitledPath(t.path)
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="explorer"
        title="Explorer"
        actions={
          <>
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
            <button
              type="button"
              title="New Folder"
              aria-label="New Folder"
              className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent"
              onClick={() => openNewFolderDialog()}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!root}
            >
              <FolderPlus className="size-3.5" />
            </button>
          </>
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
          {root && (
            <>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {root.name}
              </p>
              <TreeNode node={root} depth={0} />
            </>
          )}
          <TabSection title="Open files" tabs={openFileTabs} />
          <TabSection title="Unsaved" tabs={unsavedTabs} />
        </div>
      )}
    </div>
  );
}
