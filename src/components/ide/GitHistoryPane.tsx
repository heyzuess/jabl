"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useGitStore } from "@/lib/git/store";
import type {
  GitCommitFileChange,
  GitCommitInfo,
  GitResetMode,
} from "@/lib/git/types";

function relativeTime(ts: number): string {
  const sec = (Date.now() - ts) / 1000;
  if (sec < 60) return "just now";
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

export function GitHistoryPane() {
  const available = useGitStore((s) => s.available);
  const branch = useGitStore((s) => s.branch);
  const busy = useGitStore((s) => s.busy);
  const commits = useGitStore((s) => s.commits);
  const commitFiles = useGitStore((s) => s.commitFiles);
  const expandedCommitOid = useGitStore((s) => s.expandedCommitOid);
  const compareBaseOid = useGitStore((s) => s.compareBaseOid);
  const expandCommit = useGitStore((s) => s.expandCommit);
  const selectForCompare = useGitStore((s) => s.selectForCompare);
  const compareWithSelected = useGitStore((s) => s.compareWithSelected);
  const openCommitDiff = useGitStore((s) => s.openCommitDiff);
  const revertCommit = useGitStore((s) => s.revertCommit);
  const cherryPick = useGitStore((s) => s.cherryPick);
  const resetToCommit = useGitStore((s) => s.resetToCommit);
  const createTag = useGitStore((s) => s.createTag);
  const loadHistory = useGitStore((s) => s.loadHistory);
  const refresh = useGitStore((s) => s.refresh);

  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagObject, setTagObject] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (available) void loadHistory();
  }, [available, loadHistory]);

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
        pane="gitHistory"
        title="Git History"
        actions={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Refresh history"
              aria-label="Refresh history"
              className="inline-flex size-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
              disabled={busy || !available}
              onClick={() => void refresh()}
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            </button>
          </div>
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-2">
          {!available ? (
            <p className="px-1 text-xs text-muted-foreground">
              Open a git repository to browse commit history.
            </p>
          ) : (
            <>
              {creatingTag && (
                <div className="space-y-1 rounded border border-border p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Create tag
                    {tagObject ? (
                      <span className="ml-1 font-mono normal-case opacity-70">
                        @ {tagObject.slice(0, 7)}
                      </span>
                    ) : null}
                  </p>
                  <input
                    className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 flex-1 text-[10px]"
                      disabled={busy || !newTagName.trim()}
                      onClick={() => {
                        void createTag(newTagName.trim(), tagObject)
                          .then(() => {
                            setCreatingTag(false);
                            setNewTagName("");
                            setTagObject(undefined);
                          })
                          .catch(() => undefined);
                      }}
                    >
                      Create
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

              {branch ? (
                <p className="px-1 font-mono text-[10px] text-muted-foreground">
                  {branch}
                </p>
              ) : null}

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
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
