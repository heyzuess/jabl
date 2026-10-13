"use client";

import { Eraser, Square } from "lucide-react";
import { PaneChrome } from "./PaneChrome";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useOutputStore } from "@/lib/oe/output-store";
import type { OutputEntry } from "@/lib/oe/types";

export function OutputPane() {
  const entries = useOutputStore((s) => s.entries);
  const busy = useOutputStore((s) => s.busy);
  const clear = useOutputStore((s) => s.clear);
  const cancel = useOutputStore((s) => s.cancel);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="output"
        title="Output"
        actions={
          <div className="flex items-center gap-0.5">
            {busy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px]"
                onClick={() => cancel()}
              >
                <Square className="size-3" />
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px]"
              onClick={() => clear()}
              disabled={!entries.length}
            >
              <Eraser className="size-3" />
              Clear
            </Button>
          </div>
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-2 font-mono text-xs">
          {!entries.length && (
            <p className="px-1 text-muted-foreground">
              Compile or Run an ABL program to see OpenEdge output here.
            </p>
          )}
          {entries.map((entry) => (
            <OutputEntryView key={entry.id} entry={entry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function OutputEntryView({ entry }: { entry: OutputEntry }) {
  const requestSyntaxCheck = useWorkspaceStore((s) => s.requestSyntaxCheck);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const buffers = useWorkspaceStore((s) => s.buffers);
  const time = new Date(entry.timestamp).toLocaleTimeString();

  const openMessage = (file: string | undefined, line?: number, column?: number) => {
    if (!file) return;
    const normalized = file.replace(/\\/g, "/");
    const hit =
      openTabs.find((t) => t.path === normalized)?.path ||
      Object.keys(buffers).find(
        (p) =>
          p === normalized ||
          p.endsWith(`/${normalized}`) ||
          p.endsWith(normalized)
      ) ||
      openTabs.find(
        (t) =>
          t.path.endsWith(`/${normalized}`) || t.path.endsWith(normalized)
      )?.path ||
      normalized;
    void openFile(hit);
    requestSyntaxCheck({
      path: hit,
      line: line && line > 0 ? line : 1,
      column: column && column > 0 ? column : 1,
    });
  };

  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={cn(
            "font-semibold uppercase tracking-wide",
            entry.status === "running" && "text-amber-500",
            entry.status === "ok" && "text-emerald-500",
            entry.status === "error" && "text-red-400"
          )}
        >
          {entry.mode}
        </span>
        <span className="text-foreground">{entry.entry}</span>
        <span className="text-muted-foreground">{time}</span>
        <span className="text-muted-foreground">· {entry.status}</span>
      </div>

      {entry.missing.length > 0 && (
        <div className="mb-1 text-amber-500">
          Missing deps: {entry.missing.join(", ")}
        </div>
      )}

      {entry.error && (
        <div className="mb-1 whitespace-pre-wrap text-red-400">{entry.error}</div>
      )}

      {entry.compileMessages.map((msg, i) => (
        <button
          key={`${entry.id}-msg-${i}`}
          type="button"
          className="block w-full truncate text-left text-red-300 hover:underline"
          onClick={() => openMessage(msg.file, msg.line, msg.column)}
        >
          {msg.file ? `${msg.file}:${msg.line ?? "?"} ` : ""}
          {msg.message}
        </button>
      ))}

      {entry.stdout.trim() && (
        <pre className="mt-1 whitespace-pre-wrap text-foreground/90">
          {entry.stdout}
        </pre>
      )}
      {entry.stderr.trim() && (
        <pre className="mt-1 whitespace-pre-wrap text-red-300/90">
          {entry.stderr}
        </pre>
      )}
    </div>
  );
}
