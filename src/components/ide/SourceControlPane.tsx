"use client";

import { useEffect, type ReactNode } from "react";
import {
  Check,
  GitBranch,
  Minus,
  Plus,
  RefreshCw,
  Files,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PaneChrome } from "./PaneChrome";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useGitStore } from "@/lib/git/store";
import type { GitChange } from "@/lib/git/types";

function ChangeRow({
  change,
  actionLabel,
  onAction,
  onOpen,
}: {
  change: GitChange;
  actionLabel: string;
  onAction: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs hover:bg-accent/60">
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left"
        title={change.workspacePath}
        onClick={onOpen}
      >
        <span className="mr-1.5 inline-block w-3 font-mono text-[10px] text-muted-foreground">
          {change.status === "added"
            ? "A"
            : change.status === "deleted"
              ? "D"
              : change.status === "untracked"
                ? "U"
                : "M"}
        </span>
        {change.filepath}
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

export function SourceControlPane() {
  const minimized = useLayoutStore((s) => s.minimized.explorer);
  const setSidebarView = useLayoutStore((s) => s.setSidebarView);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const fsMode = useWorkspaceStore((s) => s.mode);
  const rootName = useWorkspaceStore((s) => s.rootName);

  const available = useGitStore((s) => s.available);
  const branch = useGitStore((s) => s.branch);
  const staged = useGitStore((s) => s.staged);
  const unstaged = useGitStore((s) => s.unstaged);
  const untracked = useGitStore((s) => s.untracked);
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

  useEffect(() => {
    void refresh();
  }, [refresh, fsMode, rootName]);

  const canCommit =
    available &&
    staged.length > 0 &&
    commitMessage.trim().length > 0 &&
    authorName.trim().length > 0 &&
    authorEmail.trim().length > 0 &&
    !busy;

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
            <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate font-mono">
                {available ? (branch ?? "HEAD") : "—"}
              </span>
            </div>

            {error && !available && (
              <p className="px-1 text-xs text-muted-foreground">{error}</p>
            )}
            {error && available && (
              <p className="px-1 text-xs text-destructive">{error}</p>
            )}

            {available && (
              <>
                <div className="space-y-1.5 px-1">
                  <textarea
                    className="min-h-[64px] w-full resize-y rounded border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus-visible:border-[var(--ide-accent)]"
                    placeholder="Commit message"
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
                    Commit
                  </Button>
                </div>

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
                      onOpen={() => void openFile(c.workspacePath)}
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
                      onOpen={() => void openFile(c.workspacePath)}
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
                      onOpen={() => void openFile(c.workspacePath)}
                    />
                  ))}
                </Section>

                {staged.length === 0 &&
                  unstaged.length === 0 &&
                  untracked.length === 0 && (
                    <p className="px-1 text-xs text-muted-foreground">
                      No changes detected.
                    </p>
                  )}
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
