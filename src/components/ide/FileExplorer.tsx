"use client";

import { useEffect, useState } from "react";
import { Panel } from "react-resizable-panels";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  FileMinus,
  Files,
  GitBranch,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAblFile } from "@/lib/abl/keywords";
import { isUntitledPath } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { useGitStore } from "@/lib/git/store";
import type { FileNode, OpenTab } from "@/lib/workspace/types";
import { LayoutGroup, LayoutSeparator } from "./layout-panels";
import { PaneChrome } from "./PaneChrome";

function relativeTime(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

function FileTimelineSection() {
  const activePath = useWorkspaceStore((s) => s.activePath);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const available = useGitStore((s) => s.available);
  const fileTimeline = useGitStore((s) => s.fileTimeline);
  const loadFileTimeline = useGitStore((s) => s.loadFileTimeline);
  const openCommitDiff = useGitStore((s) => s.openCommitDiff);

  useEffect(() => {
    if (!available || !activePath || isUntitledPath(activePath)) {
      return;
    }
    if (activePath.startsWith("gitdiff:")) return;
    void loadFileTimeline(activePath);
  }, [available, activePath, loadFileTimeline]);

  if (!available) return null;

  const rel =
    activePath && rootName && activePath.startsWith(`${rootName}/`)
      ? activePath.slice(rootName.length + 1)
      : activePath;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Timeline
        {rel ? (
          <span className="ml-1 font-mono normal-case opacity-70">
            {rel.split("/").pop()}
          </span>
        ) : null}
      </p>
      {!activePath || isUntitledPath(activePath) ? (
        <p className="px-2 text-[10px] text-muted-foreground">
          Select a file to see history.
        </p>
      ) : fileTimeline.length === 0 ? (
        <p className="px-2 text-[10px] text-muted-foreground">
          No commits for this file.
        </p>
      ) : (
        <div className="px-1">
          {fileTimeline.map((c) => (
            <button
              key={c.oid}
              type="button"
              className="mb-0.5 block w-full rounded-sm px-1 py-0.5 text-left hover:bg-accent/60"
              title={c.message}
              onClick={() => {
                if (!rel) return;
                void openCommitDiff(rel, c.oid, c.parentOid);
              }}
            >
              <span className="block truncate text-[11px] font-medium">
                {c.subject}
              </span>
              <span className="block font-mono text-[9px] text-muted-foreground">
                {c.shortOid} · {relativeTime(c.authorDate)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function gitDecorationForPath(
  path: string,
  decorations: Record<string, string>
): string | null {
  if (decorations[path]) return decorations[path];
  const prefix = `${path}/`;
  let letter: string | null = null;
  for (const key of Object.keys(decorations)) {
    if (!key.startsWith(prefix)) continue;
    const d = decorations[key]!;
    if (d === "M" || d === "U") return d;
    letter = letter ?? d;
  }
  return letter;
}

function TreeNode({
  node,
  depth,
  isRoot = false,
}: {
  node: FileNode;
  depth: number;
  isRoot?: boolean;
}) {
  const isOpen = useWorkspaceStore((s) => s.expanded.has(node.path));
  const toggleExpanded = useWorkspaceStore((s) => s.toggleExpanded);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const setCwd = useWorkspaceStore((s) => s.setCwd);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const openNewFolderDialog = useWorkspaceStore((s) => s.openNewFolderDialog);
  const closeExplorerFolder = useWorkspaceStore((s) => s.closeExplorerFolder);
  const renameEntry = useWorkspaceStore((s) => s.renameEntry);
  const deleteEntry = useWorkspaceStore((s) => s.deleteEntry);
  const isActive = useWorkspaceStore((s) => s.activePath === node.path);
  const isCwd = useWorkspaceStore((s) => s.cwd === node.path);
  const isDirty = useWorkspaceStore((s) => !!s.dirty[node.path]);
  const gitLetter = useGitStore((s) =>
    gitDecorationForPath(node.path, s.decorations)
  );
  const abl = node.kind === "file" && isAblFile(node.name);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(node.name);

  const startRename = () => {
    setDraftName(node.name);
    setRenaming(true);
  };

  const commitRename = () => {
    const next = draftName.trim();
    setRenaming(false);
    if (!next || next === node.name) return;
    void renameEntry(node.path, next);
  };

  const confirmDelete = () => {
    const label =
      node.kind === "directory"
        ? `Delete folder "${node.name}" and everything inside?`
        : `Delete file "${node.name}"?`;
    if (!window.confirm(label)) return;
    void deleteEntry(node.path);
  };

  const actionBtnClass =
    "inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100";

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
          {renaming ? (
            <input
              className="m-0.5 h-6 min-w-0 flex-1 rounded border border-[var(--ide-accent)] bg-background px-1 font-mono text-xs outline-none"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <button
                type="button"
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-accent/60"
                aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                aria-expanded={isOpen}
                title={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                onClick={() => toggleExpanded(node.path)}
              >
                {isOpen ? (
                  <ChevronDown className="size-3 shrink-0 opacity-70" />
                ) : (
                  <ChevronRight className="size-3 shrink-0 opacity-70" />
                )}
              </button>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left hover:bg-accent/60"
                onClick={() => {
                  if (!isOpen) toggleExpanded(node.path);
                  setCwd(node.path);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  if (!isRoot) startRename();
                }}
                title={node.path}
              >
                {isOpen ? (
                  <FolderOpen className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
                )}
                <span className="truncate">{node.name}</span>
                {gitLetter && (
                  <span className="ml-auto shrink-0 pl-1 font-mono text-[10px] text-[var(--ide-accent)]">
                    {gitLetter}
                  </span>
                )}
              </button>
            </>
          )}
          <button
            type="button"
            title={`New file in ${node.name}`}
            aria-label={`New file in ${node.name}`}
            className={actionBtnClass}
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
            className={actionBtnClass}
            onClick={(e) => {
              e.stopPropagation();
              setCwd(node.path);
              openNewFolderDialog(node.path);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <FolderPlus className="size-3" />
          </button>
          {isRoot && (
            <button
              type="button"
              title={`Close ${node.name}`}
              aria-label={`Close ${node.name}`}
              className={actionBtnClass}
              onClick={(e) => {
                e.stopPropagation();
                closeExplorerFolder(node.path);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X className="size-3" />
            </button>
          )}
          {!isRoot && (
            <>
              <button
                type="button"
                title={`Rename ${node.name}`}
                aria-label={`Rename ${node.name}`}
                className={actionBtnClass}
                onClick={(e) => {
                  e.stopPropagation();
                  startRename();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                title={`Delete ${node.name}`}
                aria-label={`Delete ${node.name}`}
                className={actionBtnClass}
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Trash2 className="size-3" />
              </button>
            </>
          )}
        </div>
        {isOpen &&
          (node.children ?? []).map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-0.5 rounded-sm pr-0.5 text-xs",
        isActive && "bg-accent text-accent-foreground"
      )}
      style={{ paddingLeft: 4 + depth * 12 + 14 }}
    >
      {renaming ? (
        <input
          className="m-0.5 h-6 min-w-0 flex-1 rounded border border-[var(--ide-accent)] bg-background px-1 font-mono text-xs outline-none"
          value={draftName}
          autoFocus
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => commitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left hover:bg-accent/60",
            abl && !isActive && "text-[var(--ide-keyword)]"
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void openFile(node.path);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            startRename();
          }}
          title={node.path}
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
          {gitLetter && (
            <span className="ml-auto shrink-0 pl-1 font-mono text-[10px] text-[var(--ide-accent)]">
              {gitLetter}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        title={`Rename ${node.name}`}
        aria-label={`Rename ${node.name}`}
        className={actionBtnClass}
        onClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Pencil className="size-3" />
      </button>
      <button
        type="button"
        title={`Delete ${node.name}`}
        aria-label={`Delete ${node.name}`}
        className={actionBtnClass}
        onClick={(e) => {
          e.stopPropagation();
          confirmDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function parentDirRelativeToCwd(filePath: string, cwd: string): string {
  const rel = pathRelativeTo(filePath, cwd);
  const slash = rel.lastIndexOf("/");
  if (slash <= 0) return ".";
  return rel.slice(0, slash);
}

function pathRelativeTo(filePath: string, cwd: string): string {
  const base = cwd.replace(/\/+$/, "");
  if (!base) return filePath;
  if (filePath === base) return ".";
  if (filePath.startsWith(`${base}/`)) return filePath.slice(base.length + 1);
  const from = base.split("/");
  const to = filePath.split("/");
  let shared = 0;
  while (
    shared < from.length &&
    shared < to.length &&
    from[shared] === to[shared]
  ) {
    shared += 1;
  }
  const up = Array.from({ length: from.length - shared }, () => "..");
  return [...up, ...to.slice(shared)].join("/") || ".";
}

function groupTabsByParent(
  tabs: OpenTab[],
  cwd: string
): { folder: string; tabs: OpenTab[] }[] {
  const map = new Map<string, OpenTab[]>();
  for (const tab of tabs) {
    const folder = parentDirRelativeToCwd(tab.path, cwd);
    const list = map.get(folder) ?? [];
    list.push(tab);
    map.set(folder, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === ".") return -1;
      if (b === ".") return 1;
      return a.localeCompare(b);
    })
    .map(([folder, group]) => ({
      folder,
      tabs: [...group].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function FileTabButton({ tab, indent }: { tab: OpenTab; indent: number }) {
  const setActivePath = useWorkspaceStore((s) => s.setActivePath);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const active = tab.path === activePath;
  const abl = isAblFile(tab.name);

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-0.5 rounded-sm pr-0.5 text-xs hover:bg-accent/60",
        active && "bg-accent text-accent-foreground",
        abl && !active && "text-[var(--ide-keyword)]"
      )}
      style={{ paddingLeft: indent }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
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
      <button
        type="button"
        title={`Close ${tab.name}`}
        aria-label={`Close ${tab.name}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          closeTab(tab.path);
        }}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function OpenFilesSection({ tabs }: { tabs: OpenTab[] }) {
  const cwd = useWorkspaceStore((s) => s.cwd);
  const groups = groupTabsByParent(tabs, cwd);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  if (tabs.length === 0) return null;

  const toggleFolder = (folder: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  return (
    <div className="pt-1">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Open files
      </p>
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.folder);
        return (
          <div key={group.folder}>
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent/60"
              title={group.folder}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.folder}`}
              onClick={() => toggleFolder(group.folder)}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3 shrink-0 opacity-70" />
              ) : (
                <ChevronDown className="size-3 shrink-0 opacity-70" />
              )}
              {isCollapsed ? (
                <Folder className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
              ) : (
                <FolderOpen className="size-3.5 shrink-0 text-[var(--ide-accent)]" />
              )}
              <span className="truncate">{group.folder}</span>
            </button>
            {!isCollapsed &&
              group.tabs.map((tab) => (
                <FileTabButton key={tab.path} tab={tab} indent={28} />
              ))}
          </div>
        );
      })}
    </div>
  );
}

function TabSection({
  title,
  tabs,
}: {
  title: string;
  tabs: OpenTab[];
}) {
  if (tabs.length === 0) return null;

  return (
    <div className="pt-1">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {tabs.map((tab) => (
        <FileTabButton key={tab.path} tab={tab} indent={18} />
      ))}
    </div>
  );
}

export function FileExplorer() {
  const root = useWorkspaceStore((s) => s.root);
  const explorerFolders = useWorkspaceStore((s) => s.explorerFolders);
  const loading = useWorkspaceStore((s) => s.loading);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const closeAllTabs = useWorkspaceStore((s) => s.closeAllTabs);
  const closeSavedTabs = useWorkspaceStore((s) => s.closeSavedTabs);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const openNewFolderDialog = useWorkspaceStore((s) => s.openNewFolderDialog);
  const setSidebarView = useLayoutStore((s) => s.setSidebarView);
  const folders = explorerFolders.length ? explorerFolders : root ? [root] : [];

  const openFileTabs = openTabs.filter(
    (t) => !t.unsaved && !isUntitledPath(t.path)
  );
  const unsavedTabs = openTabs.filter(
    (t) => t.unsaved || isUntitledPath(t.path)
  );
  const hasOpenTabs = openTabs.length > 0;
  const hasUnsavedChanges = openTabs.some(
    (t) => dirty[t.path] || t.unsaved || isUntitledPath(t.path)
  );

  const confirmCloseAll = () => {
    if (hasUnsavedChanges) {
      if (
        !window.confirm(
          "Close all files? Unsaved changes will be discarded."
        )
      ) {
        return;
      }
    }
    closeAllTabs();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="explorer"
        title="Explorer"
        actions={
          <>
            <button
              type="button"
              title="Source Control"
              aria-label="Show Source Control"
              className="inline-flex size-6 items-center justify-center rounded hover:bg-accent"
              onClick={() => setSidebarView("scm")}
            >
              <GitBranch className="size-3.5" />
            </button>
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
              disabled={!folders.length}
            >
              <FolderPlus className="size-3.5" />
            </button>
          </>
        }
      />
      <LayoutGroup orientation="vertical" className="min-h-0 flex-1">
        <Panel
          id="explorer-workspace"
          defaultSize="65%"
          minSize="20%"
          className="min-h-0 overflow-hidden"
        >
          <div className="h-full min-h-0 overflow-y-auto p-1 pb-2">
            {loading && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Loading…
              </p>
            )}
            {!loading && folders.length === 0 && (
              <div className="space-y-2 px-2 py-3 text-xs text-muted-foreground">
                <p>No folder open.</p>
                <p>
                  Use <span className="text-foreground">New File</span>,{" "}
                  <span className="text-foreground">Open Folder</span>, or{" "}
                  <span className="text-foreground">Samples</span>.
                </p>
              </div>
            )}
            {folders.map((folder) => (
              <TreeNode key={folder.path} node={folder} depth={0} isRoot />
            ))}
          </div>
        </Panel>
        <LayoutSeparator
          className="h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]"
          title="Resize Explorer sections"
        />
        <Panel
          id="explorer-tabs"
          defaultSize="35%"
          minSize="15%"
          className="min-h-0 overflow-hidden"
        >
          <div className="h-full min-h-0 overflow-y-auto p-1 pb-4">
            {hasOpenTabs && (
              <div className="flex items-center justify-end gap-0.5 px-1 pb-0.5">
                <button
                  type="button"
                  title="Close saved files"
                  aria-label="Close saved files"
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => closeSavedTabs()}
                >
                  <FileMinus className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Close all files"
                  aria-label="Close all files"
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={confirmCloseAll}
                >
                  <Files className="size-3.5" />
                </button>
              </div>
            )}
            <OpenFilesSection tabs={openFileTabs} />
            <TabSection title="Unsaved" tabs={unsavedTabs} />
            {openFileTabs.length === 0 && unsavedTabs.length === 0 && (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                No open or unsaved files
              </p>
            )}
            <FileTimelineSection />
          </div>
        </Panel>
      </LayoutGroup>
    </div>
  );
}
