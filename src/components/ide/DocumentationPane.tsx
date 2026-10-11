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
  useDocumentationStore,
} from "@/lib/abl/documentation-store";
import {
  ABL_REFERENCE_INDEX_PAGE,
  ablReferenceUrl,
  categoryLabel,
  searchAblDocs,
  type AblDocEntry,
} from "@/lib/abl/reference";

export function DocumentationPane() {
  const minimized = useLayoutStore((s) => s.minimized.documentation);
  const topic = useDocumentationStore((s) => s.topic);
  const filter = useDocumentationStore((s) => s.filter);
  const setFilter = useDocumentationStore((s) => s.setFilter);
  const openLanguageDoc = useDocumentationStore((s) => s.openLanguageDoc);
  const goBack = useDocumentationStore((s) => s.goBack);
  const goForward = useDocumentationStore((s) => s.goForward);
  const historyIndex = useDocumentationStore((s) => s.historyIndex);
  const history = useDocumentationStore((s) => s.history);

  const entry = useMemo(() => resolveDocEntry(topic), [topic]);
  const results = useMemo(() => searchAblDocs(filter).slice(0, 200), [filter]);

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
                placeholder="Search ABL reference…"
                className="h-8 text-xs"
              />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <ul className="p-1">
                {results.map((item) => {
                  const selected =
                    topic?.type === "language" &&
                    topic.name.toUpperCase() === item.name.toUpperCase();
                  return (
                    <li key={item.name}>
                      <button
                        type="button"
                        onClick={() => openLanguageDoc(item.name)}
                        className={cn(
                          "flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-xs",
                          selected
                            ? "bg-[var(--ide-accent)]/20 text-foreground"
                            : "text-foreground/90 hover:bg-accent/60"
                        )}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {categoryLabel(item.category)}
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
              <DocArticle entry={entry} localSymbol={topic?.type === "symbol"} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                <BookOpen className="size-8 opacity-50" />
                <p className="text-sm font-medium text-foreground/80">
                  ABL Documentation
                </p>
                <p className="max-w-sm text-xs">
                  Select a keyword from the list, or use{" "}
                  <span className="text-foreground">Open in Documentation</span>{" "}
                  from an editor hover tip. Syntax follows the Progress ABL
                  Reference.
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
}: {
  entry: AblDocEntry;
  localSymbol?: boolean;
}) {
  const url = !localSymbol
    ? ablReferenceUrl(entry.docsPage ?? ABL_REFERENCE_INDEX_PAGE)
    : null;
  const linkLabel = entry.docsPage
    ? "Progress ABL Reference"
    : "Browse ABL Syntax Reference";

  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm">
      <header className="space-y-1 border-b border-border pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {localSymbol ? "Project symbol" : categoryLabel(entry.category)}
        </div>
        <h2 className="text-lg font-semibold text-foreground">{entry.name}</h2>
        <p className="text-xs text-muted-foreground">{entry.summary}</p>
        {url && (
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
