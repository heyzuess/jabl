"use client";

import { useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { PaneChrome } from "./PaneChrome";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import {
  resolveDocEntry,
  resolveDocExternalUrl,
  searchDocumentation,
  useDocumentationStore,
} from "@/lib/abl/documentation-store";
import { getBuiltinMembers } from "@/lib/abl/builtin/builtin-types";
import {
  ABL_REFERENCE_INDEX_PAGE,
  ablReferenceUrl,
  categoryLabel,
  type AblDocEntry,
} from "@/lib/abl/reference";

export function DocumentationPane() {
  const minimized = useLayoutStore((s) => s.minimized.documentation);
  const topic = useDocumentationStore((s) => s.topic);
  const filter = useDocumentationStore((s) => s.filter);
  const setFilter = useDocumentationStore((s) => s.setFilter);
  const openLanguageDoc = useDocumentationStore((s) => s.openLanguageDoc);
  const openBuiltinDoc = useDocumentationStore((s) => s.openBuiltinDoc);
  const goBack = useDocumentationStore((s) => s.goBack);
  const goForward = useDocumentationStore((s) => s.goForward);
  const historyIndex = useDocumentationStore((s) => s.historyIndex);
  const history = useDocumentationStore((s) => s.history);

  const entry = useMemo(() => resolveDocEntry(topic), [topic]);
  const externalUrl = useMemo(() => resolveDocExternalUrl(topic), [topic]);
  const results = useMemo(() => searchDocumentation(filter), [filter]);
  const builtinMembers = useMemo(() => {
    if (topic?.type !== "builtin") return [];
    return getBuiltinMembers(topic.name);
  }, [topic]);

  const canBack = historyIndex > 0;
  const canForward = historyIndex >= 0 && historyIndex < history.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ide-sidebar)]">
      <PaneChrome
        pane="documentation"
        title="Documentation"
        actions={
          <div className="flex items-center gap-0.5">
            <ChromeIconButton
              label="Back"
              disabled={!canBack}
              onClick={goBack}
            >
              <ArrowLeft className="size-3.5" />
            </ChromeIconButton>
            <ChromeIconButton
              label="Forward"
              disabled={!canForward}
              onClick={goForward}
            >
              <ArrowRight className="size-3.5" />
            </ChromeIconButton>
          </div>
        }
      />

      {minimized ? (
        <div className="flex flex-1 items-center px-3 text-xs text-muted-foreground">
          Documentation (minimized)
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[42%] min-w-[140px] max-w-[280px] flex-col border-r border-border">
            <div className="border-b border-border p-2">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search keywords & types…"
                className="h-8 text-xs"
              />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <ul className="p-1">
                {results.map((item) => {
                  if (item.kind === "language") {
                    const selected =
                      topic?.type === "language" &&
                      topic.name.toUpperCase() === item.entry.name.toUpperCase();
                    return (
                      <li key={`lang:${item.entry.name}`}>
                        <button
                          type="button"
                          onClick={() => openLanguageDoc(item.entry.name)}
                          className={cn(
                            "flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-xs",
                            selected
                              ? "bg-[var(--ide-accent)]/20 text-foreground"
                              : "text-foreground/90 hover:bg-accent/60"
                          )}
                        >
                          <span className="font-medium">{item.entry.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {categoryLabel(item.entry.category)}
                          </span>
                        </button>
                      </li>
                    );
                  }
                  const selected =
                    topic?.type === "builtin" &&
                    topic.name.toLowerCase() === item.name.toLowerCase();
                  return (
                    <li key={`type:${item.name}`}>
                      <button
                        type="button"
                        onClick={() => openBuiltinDoc(item.name)}
                        className={cn(
                          "flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-xs",
                          selected
                            ? "bg-[var(--ide-accent)]/20 text-foreground"
                            : "text-foreground/90 hover:bg-accent/60"
                        )}
                      >
                        <span className="font-medium break-all">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          Built-in {item.typeKind}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <li className="px-2 py-3 text-xs text-muted-foreground">
                    No matching entries
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>

          <div className="min-w-0 flex-1 overflow-auto p-3">
            {entry ? (
              <DocArticle
                entry={entry}
                localSymbol={topic?.type === "symbol"}
                builtin={topic?.type === "builtin"}
                externalUrl={externalUrl}
                members={builtinMembers}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                <BookOpen className="size-8 opacity-50" />
                <p className="text-sm font-medium text-foreground/80">
                  ABL Documentation
                </p>
                <p className="max-w-sm text-xs">
                  Search keywords or Progress/OpenEdge types, or use{" "}
                  <span className="text-foreground">Open in Documentation</span>{" "}
                  from an editor hover tip.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DocArticle({
  entry,
  localSymbol,
  builtin,
  externalUrl,
  members,
}: {
  entry: AblDocEntry;
  localSymbol?: boolean;
  builtin?: boolean;
  externalUrl?: string | null;
  members?: { name: string; kind: string; signature: string; detail: string }[];
}) {
  const url =
    externalUrl ||
    (!localSymbol && !builtin
      ? ablReferenceUrl(entry.docsPage ?? ABL_REFERENCE_INDEX_PAGE)
      : null);
  const linkLabel = builtin
    ? "OpenEdge / Progress Reference"
    : entry.docsPage
      ? "Progress ABL Reference"
      : localSymbol
        ? null
        : "Browse ABL Syntax Reference";

  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm">
      <header className="space-y-1 border-b border-border pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {builtin
            ? "Built-in type"
            : localSymbol
              ? "Project symbol"
              : categoryLabel(entry.category)}
        </div>
        <h2 className="text-lg font-semibold text-foreground break-all">
          {entry.name}
        </h2>
        <p className="text-xs text-muted-foreground">{entry.summary}</p>
        {url && linkLabel && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--ide-accent)] hover:underline"
          >
            {linkLabel}
            <ExternalLink className="size-3" />
          </a>
        )}
      </header>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Syntax
        </h3>
        <pre className="overflow-x-auto rounded-md border border-border bg-[var(--ide-editor-bg)] p-3 font-mono text-xs text-[var(--ide-editor-fg)] whitespace-pre-wrap">
          {entry.syntax}
        </pre>
      </section>

      {entry.example && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Example
          </h3>
          <pre className="overflow-x-auto rounded-md border border-border bg-[var(--ide-editor-bg)] p-3 font-mono text-xs text-[var(--ide-editor-fg)] whitespace-pre-wrap">
            {entry.example}
          </pre>
        </section>
      )}

      {members && members.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Public members ({members.length})
          </h3>
          <ul className="space-y-1.5 rounded-md border border-border bg-[var(--ide-editor-bg)] p-2">
            {members.map((m) => (
              <li
                key={`${m.kind}:${m.name}:${m.signature}`}
                className="border-b border-border/60 px-1 py-1.5 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-foreground">
                    {m.name}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {m.kind}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
                  {m.signature}
                </div>
                {m.detail && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground/90">
                    {m.detail}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function ChromeIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      disabled={disabled}
      className="size-6"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </Button>
  );
}
