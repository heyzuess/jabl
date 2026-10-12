"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  FileCode2,
  Files,
  FolderGit2,
  GitBranch,
  GitMerge,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaneChrome } from "./PaneChrome";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useGitStore } from "@/lib/git/store";
import { DEFAULT_CORS_PROXY } from "@/lib/git/credentials";
import type {
  GitChange,
  GitCommitFileChange,
  GitCommitInfo,
  GitResetMode,
} from "@/lib/git/types";

function statusLetter(status: GitChange["status"]): string {
  if (status === "added") return "A";
  if (status === "deleted") return "D";
  if (status === "untracked") return "U";
  if (status === "conflict") return "C";
  return "M";
}

function ChangeRow({
  change,
  actionLabel,
  onAction,
  onOpenDiff,
  onOpenFile,
}: {
  change: GitChange;
  actionLabel: string;
  onAction: () => void;
  onOpenDiff: () => void;
  onOpenFile: () => void;
}) {
  return (
    <div className="group flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-xs hover:bg-accent/60">
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left"
        title={`Open Changes · ${change.workspacePath}`}
        onClick={onOpenDiff}
      >
        <span className="mr-1.5 inline-block w-3 font-mono text-[10px] text-muted-foreground">
          {statusLetter(change.status)}
        </span>
        {change.filepath}
      </button>
      <button
        type="button"
        title="Open File"
        aria-label="Open File"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onOpenFile();
        }}
      >
        <FileCode2 className="size-3" />
      </button>
      <button
        type="button"
        title={actionLabel}
        aria-label={actionLabel}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
      >
        {actionLabel.startsWith("Stage") ? (
          <Plus className="size-3" />
        ) : (
          <Minus className="size-3" />
        )}
      </button>
    </div>
  );
}

function ConflictRow({
  change,
  onOpenFile,
  onAccept,
}: {
  change: GitChange;
  onOpenFile: () => void;
  onAccept: (mode: "current" | "incoming" | "both") => void;
}) {
  return (
    <div className="mb-1 rounded-sm border border-destructive/30 bg-destructive/5 px-1 py-1">
      <button
        type="button"
        className="flex w-full items-center gap-1 truncate text-left text-xs"
        title={`Open conflicted file · ${change.workspacePath}`}
        onClick={onOpenFile}
      >
        <span className="mr-1 inline-block w-3 font-mono text-[10px] text-destructive">
          C
        </span>
        {change.filepath}
      </button>
      <div className="mt-1 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-5 px-1.5 text-[10px]"
          onClick={() => onAccept("current")}
        >
          Accept Current
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-5 px-1.5 text-[10px]"
          onClick={() => onAccept("incoming")}
        >
          Accept Incoming
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-5 px-1.5 text-[10px]"
          onClick={() => onAccept("both")}
        >
          Accept Both
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 px-2 pb-1">
        <p className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          <span className="ml-1 opacity-70">{count}</span>
        </p>
        {actions}
      </div>
      <div className="px-1">{children}</div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

function commitFileLetter(status: GitCommitFileChange["status"]): string {
  if (status === "added") return "A";
  if (status === "deleted") return "D";
  return "M";
}

function CommitFileRow({
  change,
  title,
  onOpen,
}: {
  change: GitCommitFileChange;
  title: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left font-mono text-[11px] hover:bg-accent/60"
      title={title}
      onClick={onOpen}
    >
      <span
        className={cn(
          "w-3 shrink-0 text-center text-[10px] font-semibold",
          change.status === "added" && "text-emerald-600 dark:text-emerald-400",
          change.status === "deleted" && "text-destructive",
          change.status === "modified" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {commitFileLetter(change.status)}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          change.status === "deleted" && "line-through opacity-80"
        )}
      >
        {change.filepath}
      </span>
    </button>
  );
}

function CommitRow({
  commit,
  expanded,
  files,
  selectedForCompare,
  canCompareWithSelected,
  onToggle,
  onOpenFile,
  onRevert,
  onCherryPick,
  onReset,
  onCreateTag,
  onSelectForCompare,
  onCompareWithSelected,
}: {
  commit: GitCommitInfo;
  expanded: boolean;
  files: GitCommitFileChange[];
  selectedForCompare: boolean;
  canCompareWithSelected: boolean;
  onToggle: () => void;
  onOpenFile: (filepath: string) => void;
  onRevert: () => void;
  onCherryPick: () => void;
  onReset: (mode: GitResetMode) => void;
  onCreateTag: () => void;
  onSelectForCompare: () => void;
  onCompareWithSelected: () => void;
}) {
  return (
    <div className="mb-1">
      <div className="group flex items-start gap-0.5">
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-start gap-1 rounded-sm px-1 py-1 text-left text-xs hover:bg-accent/60",
            selectedForCompare && "bg-accent/50 ring-1 ring-border"
          )}
          onClick={onToggle}
          title={commit.message}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 size-3 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="mt-0.5 size-3 shrink-0 opacity-70" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {selectedForCompare ? (
                <span className="mr-1 text-[10px] font-normal text-muted-foreground">
                  Compare
                </span>
              ) : null}
              {commit.subject}
            </span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              {commit.shortOid} · {commit.authorName} ·{" "}
              {relativeTime(commit.authorDate)}
            </span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                title="Commit actions"
                aria-label="Commit actions"
                className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
              />
            }
          >
            <MoreHorizontal className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onSelectForCompare}>
              Select for Compare
            </DropdownMenuItem>
            {canCompareWithSelected ? (
              <DropdownMenuItem onClick={onCompareWithSelected}>
                Compare with Selected
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCherryPick}>
              Cherry-pick…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRevert}>Revert…</DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateTag}>
              Create Tag…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Reset current branch</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onReset("soft")}>
                Reset Soft…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReset("mixed")}>
                Reset Mixed…
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onReset("hard")}
              >
                Reset Hard…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {files.length === 0 ? (
            <p className="px-1 py-0.5 text-[10px] text-muted-foreground">
              No file changes
            </p>
          ) : (
            files.map((change) => (
              <CommitFileRow
                key={change.filepath}
                change={change}
                title={`${change.status} · compare with previous · ${change.filepath}`}
                onOpen={() => onOpenFile(change.filepath)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SourceControlPane() {
  const minimized = useLayoutStore((s) => s.minimized.explorer);
  const setSidebarView = useLayoutStore((s) => s.setSidebarView);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const fsMode = useWorkspaceStore((s) => s.mode);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const hasFsRoot = useWorkspaceStore((s) => !!s.root);

  const available = useGitStore((s) => s.available);
  const branch = useGitStore((s) => s.branch);
  const branches = useGitStore((s) => s.branches);
  const tags = useGitStore((s) => s.tags);
  const commits = useGitStore((s) => s.commits);
  const stashes = useGitStore((s) => s.stashes);
  const commitFiles = useGitStore((s) => s.commitFiles);
  const expandedCommitOid = useGitStore((s) => s.expandedCommitOid);
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);
  const conflicts = useGitStore((s) => s.conflicts);
  const merging = useGitStore((s) => s.merging);
  const error = useGitStore((s) => s.error);
  const busy = useGitStore((s) => s.busy);
  const authorName = useGitStore((s) => s.authorName);
  const authorEmail = useGitStore((s) => s.authorEmail);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const setAuthorName = useGitStore((s) => s.setAuthorName);
  const setAuthorEmail = useGitStore((s) => s.setAuthorEmail);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const refresh = useGitStore((s) => s.refresh);
  const stage = useGitStore((s) => s.stage);
  const unstage = useGitStore((s) => s.unstage);
  const stageAllChanges = useGitStore((s) => s.stageAllChanges);
  const unstageAllChanges = useGitStore((s) => s.unstageAllChanges);
  const commit = useGitStore((s) => s.commit);
  const checkoutBranch = useGitStore((s) => s.checkoutBranch);
  const createBranch = useGitStore((s) => s.createBranch);
  const deleteBranch = useGitStore((s) => s.deleteBranch);
  const mergeBranch = useGitStore((s) => s.mergeBranch);
  const abortMerge = useGitStore((s) => s.abortMerge);
  const resolveConflict = useGitStore((s) => s.resolveConflict);
  const expandCommit = useGitStore((s) => s.expandCommit);
  const compareBaseOid = useGitStore((s) => s.compareBaseOid);
  const compareResult = useGitStore((s) => s.compareResult);
  const selectForCompare = useGitStore((s) => s.selectForCompare);
  const clearCompare = useGitStore((s) => s.clearCompare);
  const compareWithSelected = useGitStore((s) => s.compareWithSelected);
  const openWorkingDiff = useGitStore((s) => s.openWorkingDiff);
  const openStagedDiff = useGitStore((s) => s.openStagedDiff);
  const openCommitDiff = useGitStore((s) => s.openCommitDiff);
  const openCompareDiff = useGitStore((s) => s.openCompareDiff);
  const initRepo = useGitStore((s) => s.initRepo);
  const stashPush = useGitStore((s) => s.stashPush);
  const stashPop = useGitStore((s) => s.stashPop);
  const stashApply = useGitStore((s) => s.stashApply);
  const stashDrop = useGitStore((s) => s.stashDrop);
  const revertCommit = useGitStore((s) => s.revertCommit);
  const cherryPick = useGitStore((s) => s.cherryPick);
  const resetToCommit = useGitStore((s) => s.resetToCommit);
  const createTag = useGitStore((s) => s.createTag);
  const deleteTag = useGitStore((s) => s.deleteTag);
  const checkoutTag = useGitStore((s) => s.checkoutTag);
  const remotes = useGitStore((s) => s.remotes);
  const aheadBehind = useGitStore((s) => s.aheadBehind);
  const corsProxy = useGitStore((s) => s.corsProxy);
  const progress = useGitStore((s) => s.progress);
  const authPrompt = useGitStore((s) => s.authPrompt);
  const submitAuthPrompt = useGitStore((s) => s.submitAuthPrompt);
  const addRemote = useGitStore((s) => s.addRemote);
  const removeRemote = useGitStore((s) => s.removeRemote);
  const setCorsProxy = useGitStore((s) => s.setCorsProxy);
  const clearSavedCredentials = useGitStore((s) => s.clearSavedCredentials);
  const fetchRemote = useGitStore((s) => s.fetchRemote);
  const pullRemote = useGitStore((s) => s.pullRemote);
  const pushBranch = useGitStore((s) => s.pushBranch);
  const publishBranch = useGitStore((s) => s.publishBranch);
  const syncRemote = useGitStore((s) => s.syncRemote);
  const cloneRepository = useGitStore((s) => s.cloneRepository);

  const canInitialize =
    !available && fsMode === "fs-access" && hasFsRoot && !busy;

  const [newBranchName, setNewBranchName] = useState("");
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagObject, setTagObject] = useState<string | undefined>(undefined);
  const [stashMessage, setStashMessage] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [showClone, setShowClone] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("origin");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [addingRemote, setAddingRemote] = useState(false);
  const [editingCors, setEditingCors] = useState(false);
  const [corsDraft, setCorsDraft] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authRemember, setAuthRemember] = useState(true);

  useEffect(() => {
    void refresh();
  }, [refresh, fsMode, rootName]);

  useEffect(() => {
    if (authPrompt) {
      setAuthUser("");
      setAuthToken("");
      setAuthRemember(true);
    }
  }, [authPrompt]);

  const canCommit =
    available &&
    (merging
      ? conflicts.length === 0 &&
        authorName.trim().length > 0 &&
        authorEmail.trim().length > 0
      : staged.length > 0 &&
        commitMessage.trim().length > 0 &&
        authorName.trim().length > 0 &&
        authorEmail.trim().length > 0) &&
    !busy;

  const handleCreateBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    try {
      await createBranch(name, true);
      setNewBranchName("");
      setCreatingBranch(false);
      setBranchMenuOpen(false);
    } catch {
      /* error in store */
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await createTag(name, tagObject);
      setNewTagName("");
      setTagObject(undefined);
      setCreatingTag(false);
    } catch {
      /* error in store */
    }
  };

  const confirmReset = (oid: string, mode: GitResetMode) => {
    const short = oid.slice(0, 7);
    const msg =
      mode === "hard"
        ? `Hard reset to ${short}? This discards all uncommitted changes in the working tree and index.`
        : mode === "mixed"
          ? `Mixed reset to ${short}? Keeps working tree; resets the index.`
          : `Soft reset to ${short}? Moves HEAD only; keeps index and working tree.`;
    if (!window.confirm(msg)) return;
    void resetToCommit(oid, mode).catch(() => undefined);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="explorer"
        title="Source Control"
        actions={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Explorer"
              aria-label="Show Explorer"
              className="inline-flex size-6 items-center justify-center rounded hover:bg-accent"
              onClick={() => setSidebarView("explorer")}
            >
              <Files className="size-3.5" />
            </button>
            <button
              type="button"
              title="Refresh"
              aria-label="Refresh git status"
              className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            </button>
          </div>
        }
      />

      {minimized ? (
        <div className="flex flex-1 items-center px-3 text-xs text-muted-foreground">
          Source Control (minimized)
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-2">
            <div className="space-y-1.5 px-1">
              <DropdownMenu
                open={branchMenuOpen}
                onOpenChange={(open) => {
                  setBranchMenuOpen(open);
                  if (open) void refresh();
                }}
              >
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 min-w-0 w-full justify-start gap-1.5 px-1.5 text-xs"
                      disabled={!available}
                    />
                  }
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate font-mono">
                    {available ? (branch ?? "HEAD") : "—"}
                    {merging ? " (merging)" : ""}
                  </span>
                  <ChevronDown className="ml-auto size-3 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Branches</DropdownMenuLabel>
                    {branches.length === 0 ? (
                      <DropdownMenuItem disabled>
                        No local branches found
                      </DropdownMenuItem>
                    ) : (
                      branches.map((b) => (
                        <DropdownMenuItem
                          key={b}
                          disabled={b === branch}
                          closeOnClick={b !== branch}
                          onClick={() => {
                            if (b === branch) return;
                            void checkoutBranch(b).catch(() => undefined);
                          }}
                        >
                          <span className="font-mono text-xs">
                            {b === branch ? `* ${b}` : b}
                          </span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        setCreatingBranch(true);
                        setBranchMenuOpen(false);
                      }}
                    >
                      <Plus className="size-3.5" />
                      Create branch…
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Merge into current</DropdownMenuLabel>
                    {branches
                      .filter((b) => b !== branch)
                      .map((b) => (
                        <DropdownMenuItem
                          key={`merge-${b}`}
                          disabled={busy || merging}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Merge branch "${b}" into "${branch}"?`
                              )
                            ) {
                              return;
                            }
                            void mergeBranch(b).catch(() => undefined);
                          }}
                        >
                          <GitMerge className="size-3.5" />
                          <span className="font-mono text-xs">{b}</span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Tags</DropdownMenuLabel>
                    {tags.length === 0 ? (
                      <DropdownMenuItem disabled>No tags</DropdownMenuItem>
                    ) : (
                      tags.map((t) => (
                        <DropdownMenuItem
                          key={`tag-${t}`}
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Checkout tag "${t}"? (detached HEAD)`
                              )
                            ) {
                              return;
                            }
                            void checkoutTag(t).catch(() => undefined);
                          }}
                        >
                          <Tag className="size-3.5" />
                          <span className="font-mono text-xs">{t}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                    <DropdownMenuItem
                      disabled={busy}
                      onClick={() => {
                        setTagObject(undefined);
                        setCreatingTag(true);
                        setBranchMenuOpen(false);
                      }}
                    >
                      <Plus className="size-3.5" />
                      Create tag…
                    </DropdownMenuItem>
                    {tags.map((t) => (
                      <DropdownMenuItem
                        key={`deltag-${t}`}
                        disabled={busy}
                        className="text-destructive"
                        onClick={() => {
                          if (!window.confirm(`Delete tag "${t}"?`)) return;
                          void deleteTag(t).catch(() => undefined);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="font-mono text-xs">Delete {t}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Delete branch</DropdownMenuLabel>
                    {branches
                      .filter((b) => b !== branch)
                      .map((b) => (
                        <DropdownMenuItem
                          key={`del-${b}`}
                          disabled={busy}
                          className="text-destructive"
                          onClick={() => {
                            if (!window.confirm(`Delete branch "${b}"?`)) {
                              return;
                            }
                            void deleteBranch(b).catch(() => undefined);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="font-mono text-xs">{b}</span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {available && (
                <div className="flex flex-wrap items-center gap-1 px-0.5">
                  {aheadBehind.upstream ? (
                    <span
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
                      title={`Upstream ${aheadBehind.upstream.remote}/${aheadBehind.upstream.remoteBranch}`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <ArrowUp className="size-2.5" />
                        {aheadBehind.ahead}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <ArrowDown className="size-2.5" />
                        {aheadBehind.behind}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      No upstream
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-0.5">
                    {aheadBehind.upstream ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        disabled={busy}
                        title="Fetch, then pull or push"
                        onClick={() =>
                          void syncRemote().catch(() => undefined)
                        }
                      >
                        <CloudUpload className="size-3" />
                        Sync
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        disabled={busy || remotes.length === 0}
                        title="Push and set upstream"
                        onClick={() =>
                          void publishBranch(
                            remotes[0]?.remote ?? "origin"
                          ).catch(() => undefined)
                        }
                      >
                        <CloudUpload className="size-3" />
                        Publish
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1 text-[10px]"
                            disabled={busy}
                          />
                        }
                      >
                        ⋯
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem
                          disabled={busy || remotes.length === 0}
                          onClick={() =>
                            void fetchRemote(
                              aheadBehind.upstream?.remote ??
                                remotes[0]?.remote ??
                                "origin"
                            ).catch(() => undefined)
                          }
                        >
                          Fetch
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy || remotes.length === 0}
                          onClick={() =>
                            void pullRemote(
                              aheadBehind.upstream?.remote
                            ).catch(() => undefined)
                          }
                        >
                          Pull
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy || remotes.length === 0}
                          onClick={() =>
                            void pushBranch().catch(() => undefined)
                          }
                        >
                          Push
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}

              {progress && (
                <p className="px-0.5 text-[10px] text-muted-foreground">
                  {progress}
                </p>
              )}

              {creatingBranch && available && (
                <div className="space-y-1 rounded border border-border bg-background/60 p-1.5">
                  <input
                    autoFocus
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                    placeholder="New branch name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateBranch();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setCreatingBranch(false);
                        setNewBranchName("");
                      }
                    }}
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 flex-1 text-[10px]"
                      disabled={!newBranchName.trim() || busy}
                      onClick={() => void handleCreateBranch()}
                    >
                      Create & Checkout
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        setCreatingBranch(false);
                        setNewBranchName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {creatingTag && available && (
                <div className="space-y-1 rounded border border-border bg-background/60 p-1.5">
                  <input
                    autoFocus
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateTag();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setCreatingTag(false);
                        setNewTagName("");
                        setTagObject(undefined);
                      }
                    }}
                  />
                  {tagObject && (
                    <p className="px-0.5 font-mono text-[10px] text-muted-foreground">
                      on {tagObject.slice(0, 7)}
                    </p>
                  )}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 flex-1 text-[10px]"
                      disabled={!newTagName.trim() || busy}
                      onClick={() => void handleCreateTag()}
                    >
                      Create Tag
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        setCreatingTag(false);
                        setNewTagName("");
                        setTagObject(undefined);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="px-1 text-xs text-destructive">{error}</p>
            )}

            {!available && (
              <div className="space-y-2 px-1">
                {canInitialize ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      This folder is not a git repository yet.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 w-full gap-1.5 text-xs"
                      disabled={busy}
                      onClick={() =>
                        void initRepo("main").catch(() => undefined)
                      }
                    >
                      <FolderGit2 className="size-3.5" />
                      Initialize Repository
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {error ||
                      "Open a local folder with File System Access to use Source Control."}
                  </p>
                )}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Clone Repository
                  </p>
                  {showClone ? (
                    <div className="space-y-1">
                      <input
                        autoFocus
                        className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                        placeholder="https://github.com/org/repo.git"
                        value={cloneUrl}
                        onChange={(e) => setCloneUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const url = cloneUrl.trim();
                            if (!url) return;
                            void cloneRepository(url)
                              .then(() => {
                                setCloneUrl("");
                                setShowClone(false);
                              })
                              .catch(() => undefined);
                          }
                          if (e.key === "Escape") {
                            setShowClone(false);
                            setCloneUrl("");
                          }
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        HTTPS only. You will pick an empty folder. CORS proxy:{" "}
                        {corsProxy || DEFAULT_CORS_PROXY}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 flex-1 text-[10px]"
                          disabled={busy || !cloneUrl.trim()}
                          onClick={() => {
                            const url = cloneUrl.trim();
                            if (!url) return;
                            void cloneRepository(url)
                              .then(() => {
                                setCloneUrl("");
                                setShowClone(false);
                              })
                              .catch(() => undefined);
                          }}
                        >
                          Clone…
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setShowClone(false);
                            setCloneUrl("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-xs"
                      disabled={busy}
                      onClick={() => setShowClone(true)}
                    >
                      Clone Repository…
                    </Button>
                  )}
                </div>
              </div>
            )}

            {available && (
              <>
                {merging && (
                  <div className="space-y-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Merge in progress
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Resolve conflicts, then Commit (or Abort Merge).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 w-full text-[10px]"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Abort the current merge?")) return;
                        void abortMerge().catch(() => undefined);
                      }}
                    >
                      Abort Merge
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5 px-1">
                  <textarea
                    className="min-h-[64px] w-full resize-y rounded border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                    placeholder={
                      merging ? "Merge commit message (optional)" : "Commit message"
                    }
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                  {(!authorName.trim() || !authorEmail.trim()) && (
                    <div className="grid gap-1">
                      <input
                        className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                        placeholder="Author name"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                      />
                      <input
                        className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                        placeholder="Author email"
                        value={authorEmail}
                        onChange={(e) => setAuthorEmail(e.target.value)}
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 w-full gap-1 text-xs"
                    disabled={!canCommit}
                    onClick={() => void commit().catch(() => undefined)}
                  >
                    <Check className="size-3.5" />
                    {merging ? "Commit Merge" : "Commit"}
                  </Button>
                </div>

                <Section title="Merge Conflicts" count={conflicts.length}>
                  {conflicts.map((c) => (
                    <ConflictRow
                      key={`c-${c.filepath}`}
                      change={c}
                      onOpenFile={() => void openFile(c.workspacePath)}
                      onAccept={(mode) =>
                        void resolveConflict(c.filepath, mode).catch(
                          () => undefined
                        )
                      }
                    />
                  ))}
                </Section>

                <Section
                  title="Staged"
                  count={staged.length}
                  actions={
                    <button
                      type="button"
                      title="Unstage all"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => void unstageAllChanges()}
                    >
                      Unstage All
                    </button>
                  }
                >
                  {staged.map((c) => (
                    <ChangeRow
                      key={`s-${c.filepath}`}
                      change={c}
                      actionLabel="Unstage"
                      onAction={() => void unstage([c.filepath])}
                      onOpenDiff={() => void openStagedDiff(c.filepath)}
                      onOpenFile={() => void openFile(c.workspacePath)}
                    />
                  ))}
                </Section>

                <Section
                  title="Changes"
                  count={unstaged.length}
                  actions={
                    <button
                      type="button"
                      title="Stage all changes"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => void stageAllChanges()}
                    >
                      Stage All
                    </button>
                  }
                >
                  {unstaged.map((c) => (
                    <ChangeRow
                      key={`u-${c.filepath}`}
                      change={c}
                      actionLabel="Stage"
                      onAction={() => void stage([c.filepath])}
                      onOpenDiff={() => void openWorkingDiff(c.filepath)}
                      onOpenFile={() => void openFile(c.workspacePath)}
                    />
                  ))}
                </Section>

                <Section
                  title="Untracked"
                  count={untracked.length}
                  actions={
                    untracked.length > 0 ? (
                      <button
                        type="button"
                        title="Stage all untracked"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          void stage(untracked.map((c) => c.filepath))
                        }
                      >
                        Stage All
                      </button>
                    ) : null
                  }
                >
                  {untracked.map((c) => (
                    <ChangeRow
                      key={`t-${c.filepath}`}
                      change={c}
                      actionLabel="Stage"
                      onAction={() => void stage([c.filepath])}
                      onOpenDiff={() => void openWorkingDiff(c.filepath)}
                      onOpenFile={() => void openFile(c.workspacePath)}
                    />
                  ))}
                </Section>

                {staged.length === 0 &&
                  unstaged.length === 0 &&
                  untracked.length === 0 &&
                  conflicts.length === 0 &&
                  !merging && (
                    <p className="px-1 text-xs text-muted-foreground">
                      No changes detected.
                    </p>
                  )}

                <div className="mb-2">
                  <div className="flex items-center gap-1 px-2 pb-1">
                    <p className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Stash
                      <span className="ml-1 opacity-70">{stashes.length}</span>
                    </p>
                  </div>
                  <div className="space-y-1 px-1">
                    <div className="flex gap-1">
                      <input
                        className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus-visible:border-[var(--ide-accent)]"
                        placeholder="Stash message (optional)"
                        value={stashMessage}
                        onChange={(e) => setStashMessage(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy}
                        onClick={() =>
                          void stashPush({
                            message: stashMessage || undefined,
                          })
                            .then(() => setStashMessage(""))
                            .catch(() => undefined)
                        }
                      >
                        Stash
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy}
                        onClick={() =>
                          void stashPush({
                            message: stashMessage || undefined,
                            includeUntracked: true,
                          })
                            .then(() => setStashMessage(""))
                            .catch(() => undefined)
                        }
                      >
                        Stash -u
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy || stashes.length === 0}
                        onClick={() =>
                          void stashPop(0).catch(() => undefined)
                        }
                      >
                        Pop
                      </Button>
                    </div>
                    {stashes.map((s) => (
                      <div
                        key={`stash-${s.index}`}
                        className="group flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[11px] hover:bg-accent/60"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">
                          stash@{"{" + s.index + "}"}: {s.message}
                        </span>
                        <button
                          type="button"
                          title="Apply"
                          className="text-[10px] text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                          onClick={() =>
                            void stashApply(s.index).catch(() => undefined)
                          }
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          title="Pop"
                          className="text-[10px] text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                          onClick={() =>
                            void stashPop(s.index).catch(() => undefined)
                          }
                        >
                          Pop
                        </button>
                        <button
                          type="button"
                          title="Drop"
                          className="text-[10px] text-destructive opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Drop stash@{${s.index}}? This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            void stashDrop(s.index).catch(() => undefined);
                          }}
                        >
                          Drop
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {(compareBaseOid || compareResult) && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between gap-1 px-2 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Compare
                        {compareResult ? (
                          <span className="ml-1 font-mono normal-case opacity-70">
                            {compareResult.baseOid.slice(0, 7)} →{" "}
                            {compareResult.headOid.slice(0, 7)}
                            <span className="ml-1">
                              {compareResult.files.length}
                            </span>
                          </span>
                        ) : (
                          <span className="ml-1 font-mono normal-case opacity-70">
                            {compareBaseOid!.slice(0, 7)} selected
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => clearCompare()}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="px-1">
                      {!compareResult ? (
                        <p className="px-1 text-xs text-muted-foreground">
                          Choose another commit → Compare with Selected
                        </p>
                      ) : compareResult.files.length === 0 ? (
                        <p className="px-1 text-xs text-muted-foreground">
                          No file differences between these commits.
                        </p>
                      ) : (
                        compareResult.files.map((change) => (
                          <CommitFileRow
                            key={change.filepath}
                            change={change}
                            title={`${change.status} · ${compareResult.baseOid.slice(0, 7)} → ${compareResult.headOid.slice(0, 7)} · ${change.filepath}`}
                            onOpen={() =>
                              void openCompareDiff(
                                change.filepath,
                                compareResult.baseOid,
                                compareResult.headOid
                              )
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-2">
                  <div className="flex items-center justify-between gap-1 px-2 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Remotes
                      <span className="ml-1 opacity-70">{remotes.length}</span>
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setAddingRemote((v) => !v);
                        setNewRemoteName(remotes.length ? "" : "origin");
                        setNewRemoteUrl("");
                      }}
                    >
                      {addingRemote ? "Cancel" : "Add"}
                    </button>
                  </div>
                  <div className="space-y-1 px-1">
                    {remotes.length === 0 && !addingRemote ? (
                      <p className="px-1 text-xs text-muted-foreground">
                        No remotes. Add an HTTPS origin to fetch/push.
                      </p>
                    ) : (
                      remotes.map((r) => (
                        <div
                          key={r.remote}
                          className="group flex items-start gap-1 rounded-sm px-1 py-0.5 hover:bg-accent/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[11px] font-medium">
                              {r.remote}
                            </p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground">
                              {r.url}
                            </p>
                          </div>
                          <button
                            type="button"
                            title={`Remove ${r.remote}`}
                            className="mt-0.5 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              if (
                                !window.confirm(`Remove remote "${r.remote}"?`)
                              ) {
                                return;
                              }
                              void removeRemote(r.remote).catch(
                                () => undefined
                              );
                            }}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))
                    )}
                    {addingRemote && (
                      <div className="space-y-1 rounded border border-border p-1.5">
                        <input
                          className="h-6 w-full rounded border border-border bg-background px-1.5 font-mono text-[11px] outline-none"
                          placeholder="name (origin)"
                          value={newRemoteName}
                          onChange={(e) => setNewRemoteName(e.target.value)}
                        />
                        <input
                          className="h-6 w-full rounded border border-border bg-background px-1.5 font-mono text-[11px] outline-none"
                          placeholder="https://…"
                          value={newRemoteUrl}
                          onChange={(e) => setNewRemoteUrl(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 w-full text-[10px]"
                          disabled={
                            busy ||
                            !newRemoteName.trim() ||
                            !newRemoteUrl.trim()
                          }
                          onClick={() => {
                            void addRemote(newRemoteName, newRemoteUrl)
                              .then(() => {
                                setAddingRemote(false);
                                setNewRemoteUrl("");
                              })
                              .catch(() => undefined);
                          }}
                        >
                          Add remote
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setCorsDraft(corsProxy || DEFAULT_CORS_PROXY);
                          setEditingCors((v) => !v);
                        }}
                      >
                        CORS proxy
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => clearSavedCredentials()}
                      >
                        Clear credentials
                      </button>
                    </div>
                    {editingCors && (
                      <div className="space-y-1">
                        <input
                          className="h-6 w-full rounded border border-border bg-background px-1.5 font-mono text-[10px] outline-none"
                          value={corsDraft}
                          onChange={(e) => setCorsDraft(e.target.value)}
                          placeholder={DEFAULT_CORS_PROXY}
                        />
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 flex-1 text-[10px]"
                            disabled={busy}
                            onClick={() => {
                              void setCorsProxy(corsDraft)
                                .then(() => setEditingCors(false))
                                .catch(() => undefined);
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setEditingCors(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Commits
                    <span className="ml-1 opacity-70">{commits.length}</span>
                  </p>
                  <div className="px-1">
                    {commits.length === 0 ? (
                      <p className="px-1 text-xs text-muted-foreground">
                        No commits yet.
                      </p>
                    ) : (
                      commits.map((c) => (
                        <CommitRow
                          key={c.oid}
                          commit={c}
                          expanded={expandedCommitOid === c.oid}
                          files={commitFiles[c.oid] ?? []}
                          selectedForCompare={compareBaseOid === c.oid}
                          canCompareWithSelected={
                            !!compareBaseOid && compareBaseOid !== c.oid
                          }
                          onToggle={() => void expandCommit(c.oid)}
                          onOpenFile={(fp) =>
                            void openCommitDiff(fp, c.oid, c.parentOid)
                          }
                          onRevert={() => {
                            if (
                              !window.confirm(
                                `Revert commit ${c.shortOid}?\n\n${c.subject}`
                              )
                            ) {
                              return;
                            }
                            void revertCommit(c.oid).catch(() => undefined);
                          }}
                          onCherryPick={() => {
                            if (
                              !window.confirm(
                                `Cherry-pick ${c.shortOid} onto ${branch}?`
                              )
                            ) {
                              return;
                            }
                            void cherryPick(c.oid).catch(() => undefined);
                          }}
                          onReset={(mode) => confirmReset(c.oid, mode)}
                          onCreateTag={() => {
                            setTagObject(c.oid);
                            setNewTagName("");
                            setCreatingTag(true);
                          }}
                          onSelectForCompare={() => selectForCompare(c.oid)}
                          onCompareWithSelected={() =>
                            void compareWithSelected(c.oid)
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      )}

      <Dialog
        open={!!authPrompt}
        onOpenChange={(open) => {
          if (!open) submitAuthPrompt(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Git credentials</DialogTitle>
            <DialogDescription>
              {authPrompt?.reason === "rejected"
                ? "Authentication failed. Enter a username and personal access token."
                : "Enter a username and personal access token for HTTPS git."}{" "}
              Host:{" "}
              <span className="font-mono text-foreground">
                {authPrompt?.host}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              className="h-8 w-full rounded border border-border bg-background px-2 text-sm outline-none focus-visible:border-[var(--ide-accent)]"
              placeholder="Username"
              value={authUser}
              onChange={(e) => setAuthUser(e.target.value)}
              autoComplete="username"
            />
            <input
              type="password"
              className="h-8 w-full rounded border border-border bg-background px-2 text-sm outline-none focus-visible:border-[var(--ide-accent)]"
              placeholder="Personal access token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              autoComplete="current-password"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={authRemember}
                onChange={(e) => setAuthRemember(e.target.checked)}
              />
              Remember for this host
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => submitAuthPrompt(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!authUser.trim() || !authToken}
              onClick={() =>
                submitAuthPrompt({
                  username: authUser.trim(),
                  password: authToken,
                  remember: authRemember,
                })
              }
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
