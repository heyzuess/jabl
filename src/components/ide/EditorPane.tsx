"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import {
  Columns2,
  FilePlus,
  Rows2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { registerAblLanguage } from "@/lib/abl/register";
import {
  checkAblSyntax,
  diagnosticsToMarkers,
} from "@/lib/abl/syntax-check";
import { MONACO_THEME_NAME } from "@/lib/theme/themes";
import {
  MAX_EDITOR_GROUPS,
  useEditorLayoutStore,
  type EditorGroupId,
} from "@/lib/workspace/editor-layout-store";
import { useWorkspaceStore } from "@/lib/workspace/store";
import type { DiffTabView, OpenTab } from "@/lib/workspace/types";
import { loadDiffSidesForView, useGitStore } from "@/lib/git/store";
import {
  changeAtModifiedLine,
  changesIntersectingSelection,
  type LineChange,
} from "@/lib/git/hunk-stage";

const MARKER_OWNER = "abl-syntax";
const TAB_MIME = "application/x-jabl-tab";

type EditorPaneProps = {
  groupId: EditorGroupId;
  applyTheme: (monaco: typeof Monaco) => void;
  themeKey: string;
};

export function EditorPane({
  groupId,
  applyTheme,
  themeKey,
}: EditorPaneProps) {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const buffers = useWorkspaceStore((s) => s.buffers);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const syntaxCheckNonce = useWorkspaceStore((s) => s.syntaxCheckNonce);
  const syntaxFocus = useWorkspaceStore((s) => s.syntaxFocus);
  const clearSyntaxFocus = useWorkspaceStore((s) => s.clearSyntaxFocus);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const updateBuffer = useWorkspaceStore((s) => s.updateBuffer);
  const saveActive = useWorkspaceStore((s) => s.saveActive);
  const setWorkspaceActive = useWorkspaceStore((s) => s.setActivePath);

  const group = useEditorLayoutStore((s) => s.groups[groupId]);
  const focusedGroupId = useEditorLayoutStore((s) => s.focusedGroupId);
  const focusGroup = useEditorLayoutStore((s) => s.focusGroup);
  const setGroupActivePath = useEditorLayoutStore((s) => s.setGroupActivePath);
  const reorderTabsInGroup = useEditorLayoutStore((s) => s.reorderTabsInGroup);
  const moveTab = useEditorLayoutStore((s) => s.moveTab);
  const splitGroup = useEditorLayoutStore((s) => s.splitGroup);
  const closeGroup = useEditorLayoutStore((s) => s.closeGroup);
  const leafCount = useEditorLayoutStore((s) => {
    const countLeaves = (node: typeof s.root): number =>
      node.type === "leaf"
        ? 1
        : node.children.reduce((n, c) => n + countLeaves(c), 0);
    return countLeaves(s.root);
  });
  const canSplit = leafCount < MAX_EDITOR_GROUPS;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [edgeHint, setEdgeHint] = useState<"right" | "down" | null>(null);

  const activePath = group?.activePath ?? null;
  const isFocused = focusedGroupId === groupId;

  const groupTabs = useMemo(() => {
    const paths = group?.tabPaths ?? [];
    return paths
      .map((p) => openTabs.find((t) => t.path === p))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [group?.tabPaths, openTabs]);

  const activeTab = groupTabs.find((t) => t.path === activePath);
  const value = activePath ? (buffers[activePath] ?? "") : "";

  const applyMarkers = useCallback(
    (_path: string | null, source: string, language: string | undefined) => {
      const monaco = monacoRef.current;
      const model = editorRef.current?.getModel() ?? null;
      if (!monaco || !model) return;

      if (language !== "abl") {
        monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
        return;
      }

      const diags = checkAblSyntax(source);
      const markers = diagnosticsToMarkers(diags).map((m) => ({
        ...m,
        severity:
          m.severity === "Error"
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
      }));
      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    },
    []
  );

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      monacoRef.current = monaco;
      editorRef.current = editor;
      registerAblLanguage(monaco);
      applyTheme(monaco);
    },
    [applyTheme]
  );

  useEffect(() => {
    if (monacoRef.current) {
      applyTheme(monacoRef.current);
    }
  }, [applyTheme, themeKey]);

  useEffect(() => {
    if (!activePath || !activeTab) return;
    const handle = window.setTimeout(() => {
      applyMarkers(activePath, value, activeTab.language);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [activePath, activeTab, value, applyMarkers, syntaxCheckNonce]);

  useEffect(() => {
    if (!syntaxFocus || !editorRef.current) return;
    if (syntaxFocus.path !== activePath) return;
    if (!isFocused) return;
    editorRef.current.revealLineInCenter(syntaxFocus.line);
    editorRef.current.setPosition({
      lineNumber: syntaxFocus.line,
      column: syntaxFocus.column,
    });
    editorRef.current.focus();
    clearSyntaxFocus();
  }, [syntaxFocus, activePath, clearSyntaxFocus, isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveActive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive, isFocused]);

  const activate = (path: string) => {
    setGroupActivePath(groupId, path);
    setWorkspaceActive(path);
  };

  const onFocusPane = () => {
    focusGroup(groupId);
    if (activePath) setWorkspaceActive(activePath);
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col border border-transparent bg-[var(--ide-editor-bg)]",
        isFocused && "border-[var(--ide-accent)]/50"
      )}
      onMouseDown={onFocusPane}
    >
      <div className="flex h-9 shrink-0 items-end gap-px border-b border-border bg-[var(--ide-chrome)]">
        <div
          className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto"
          onDragOver={(e) => {
            if (![...e.dataTransfer.types].includes(TAB_MIME)) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (canSplit && x > rect.width * 0.75) setEdgeHint("right");
            else if (canSplit && y > rect.height * 0.55) setEdgeHint("down");
            else setEdgeHint(null);
          }}
          onDragLeave={() => setEdgeHint(null)}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData(TAB_MIME);
            setEdgeHint(null);
            if (!raw) return;
            const [fromGroupId, path] = raw.split("\t");
            if (!fromGroupId || !path) return;
            if (edgeHint === "right" || edgeHint === "down") {
              const newId = splitGroup(groupId, edgeHint);
              if (newId) {
                moveTab(path, fromGroupId, newId);
              }
              return;
            }
            moveTab(path, fromGroupId, groupId);
          }}
        >
          {groupTabs.length === 0 && (
            <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
              No file open
            </div>
          )}
          {groupTabs.map((tab, index) => {
            const active = tab.path === activePath;
            return (
              <div
                key={tab.path}
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(
                    TAB_MIME,
                    `${groupId}\t${tab.path}`
                  );
                  e.dataTransfer.setData("text/plain", tab.path);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverIndex(index);
                }}
                onDragLeave={() => {
                  setOverIndex((current) =>
                    current === index ? null : current
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const raw = e.dataTransfer.getData(TAB_MIME);
                  setDragIndex(null);
                  setOverIndex(null);
                  setEdgeHint(null);
                  if (raw) {
                    const [fromGroupId, path] = raw.split("\t");
                    if (fromGroupId && path) {
                      moveTab(path, fromGroupId, groupId, index);
                      return;
                    }
                  }
                  if (dragIndex != null && dragIndex !== index) {
                    reorderTabsInGroup(groupId, dragIndex, index);
                  }
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                  setEdgeHint(null);
                }}
                className={cn(
                  "group flex h-8 max-w-[180px] cursor-grab items-center gap-1 border-r border-border px-2 text-xs active:cursor-grabbing",
                  active
                    ? "bg-[var(--ide-editor-bg)] text-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-accent/40",
                  overIndex === index &&
                    dragIndex !== null &&
                    dragIndex !== index &&
                    "ring-1 ring-inset ring-[var(--ide-accent)]"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => activate(tab.path)}
                  title={
                    tab.unsaved ? `Unsaved · ${tab.path}` : tab.path
                  }
                >
                  {tab.name}
                  {dirty[tab.path] ? " *" : ""}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
          {edgeHint && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-[var(--ide-accent)]/10" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 px-1 pb-1">
          <button
            type="button"
            title="Split Right"
            aria-label="Split Right"
            disabled={!canSplit}
            className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent disabled:opacity-40"
            onClick={() => {
              onFocusPane();
              splitGroup(groupId, "right", { moveActiveTab: true });
            }}
          >
            <Columns2 className="size-3.5" />
          </button>
          <button
            type="button"
            title="Split Down"
            aria-label="Split Down"
            disabled={!canSplit}
            className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent disabled:opacity-40"
            onClick={() => {
              onFocusPane();
              splitGroup(groupId, "down", { moveActiveTab: true });
            }}
          >
            <Rows2 className="size-3.5" />
          </button>
          {leafCount > 1 && (
            <button
              type="button"
              title="Close Group"
              aria-label="Close Group"
              className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent"
              onClick={() => closeGroup(groupId)}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {activeTab?.view?.type === "diff" ? (
          <GitDiffEditorPane
            key={activeTab.path}
            groupId={groupId}
            tab={activeTab}
            view={activeTab.view}
            applyTheme={applyTheme}
            themeKey={themeKey}
          />
        ) : activeTab ? (
          <Editor
            path={`${groupId}:${activeTab.path}`}
            language={activeTab.language}
            theme={MONACO_THEME_NAME}
            value={value}
            onChange={(v) => {
              if (activePath != null && v != null) updateBuffer(activePath, v);
            }}
            onMount={handleMount}
            options={{
              fontSize: 13,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 8 },
              renderLineHighlight: "line",
              smoothScrolling: true,
              hover: {
                enabled: "on",
                delay: 400,
                // Keep hover open so links (e.g. Open in Documentation) are clickable
                sticky: true,
                hidingDelay: 500,
              },
            }}
            loading={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading editor…
              </div>
            }
          />
        ) : (
          <EmptyEditor />
        )}
      </div>
    </div>
  );
}

function monacoChangesToLineChanges(
  changes: Monaco.editor.ILineChange[] | null | undefined
): LineChange[] {
  if (!changes?.length) return [];
  return changes.map((c) => ({
    originalStartLineNumber: c.originalStartLineNumber,
    originalEndLineNumber: c.originalEndLineNumber,
    modifiedStartLineNumber: c.modifiedStartLineNumber,
    modifiedEndLineNumber: c.modifiedEndLineNumber,
  }));
}

function GitDiffEditorPane({
  groupId,
  tab,
  view,
  applyTheme,
  themeKey,
}: {
  groupId: EditorGroupId;
  tab: OpenTab;
  view: DiffTabView;
  applyTheme: (monaco: typeof Monaco) => void;
  themeKey: string;
}) {
  const updateBuffer = useWorkspaceStore((s) => s.updateBuffer);
  const stageHunks = useGitStore((s) => s.stageHunks);
  const unstageHunks = useGitStore((s) => s.unstageHunks);
  const gitBusy = useGitStore((s) => s.busy);
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hunkBusy, setHunkBusy] = useState(false);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const diffEditorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(
    null
  );
  const editable = view.mode === "working";
  const canStageHunks = view.mode === "working" || view.mode === "staged";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadDiffSidesForView(view)
      .then((sides) => {
        if (cancelled) return;
        setOriginal(sides.original);
        const live = useWorkspaceStore.getState().buffers[view.workspacePath];
        setModified(editable && live != null ? live : sides.modified);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, editable]);

  useEffect(() => {
    if (monacoRef.current) applyTheme(monacoRef.current);
  }, [applyTheme, themeKey]);

  const collectTargetChanges = (preferSelection: boolean): LineChange[] => {
    const editor = diffEditorRef.current;
    if (!editor) return [];
    const all = monacoChangesToLineChanges(editor.getLineChanges());
    if (!all.length) return [];
    const mod = editor.getModifiedEditor();
    const sel = mod.getSelection();
    if (preferSelection && sel && !sel.isEmpty()) {
      const hit = changesIntersectingSelection(
        all,
        sel.startLineNumber,
        sel.endLineNumber
      );
      if (hit.length) return hit;
    }
    const line = sel?.positionLineNumber ?? mod.getPosition()?.lineNumber ?? 1;
    const at = changeAtModifiedLine(all, line);
    return at ? [at] : [];
  };

  const runHunkAction = async (preferSelection: boolean) => {
    const changes = collectTargetChanges(preferSelection);
    if (!changes.length) {
      useWorkspaceStore
        .getState()
        .setStatus("No diff hunk at cursor/selection");
      return;
    }
    setHunkBusy(true);
    try {
      if (view.mode === "working") {
        await stageHunks(view.filepath, changes);
        useWorkspaceStore.getState().setStatus(
          `Staged ${changes.length} hunk(s) in ${view.filepath}`
        );
      } else if (view.mode === "staged") {
        await unstageHunks(view.filepath, changes);
        useWorkspaceStore.getState().setStatus(
          `Unstaged ${changes.length} hunk(s) in ${view.filepath}`
        );
      }
      // Reload sides after index change
      const sides = await loadDiffSidesForView(view);
      setOriginal(sides.original);
      setModified(sides.modified);
    } catch (err) {
      useWorkspaceStore
        .getState()
        .setStatus((err as Error).message);
    } finally {
      setHunkBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading diff…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-[var(--ide-chrome)] px-2 py-1 font-mono text-[10px] text-muted-foreground">
        <span className="truncate">{view.originalLabel}</span>
        <span>↔</span>
        <span className="truncate">{view.modifiedLabel}</span>
        <span className="truncate text-foreground/80">{view.filepath}</span>
        {canStageHunks && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-5 px-1.5 text-[10px]"
              disabled={hunkBusy || gitBusy}
              onClick={() => void runHunkAction(false)}
            >
              {view.mode === "working" ? "Stage Hunk" : "Unstage Hunk"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-5 px-1.5 text-[10px]"
              disabled={hunkBusy || gitBusy}
              onClick={() => void runHunkAction(true)}
            >
              {view.mode === "working"
                ? "Stage Selection"
                : "Unstage Selection"}
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <DiffEditor
          key={`${groupId}:${tab.path}`}
          original={original}
          modified={modified}
          language={tab.language}
          theme={MONACO_THEME_NAME}
          keepCurrentOriginalModel
          keepCurrentModifiedModel
          onMount={(editor, monaco) => {
            monacoRef.current = monaco;
            diffEditorRef.current = editor;
            registerAblLanguage(monaco);
            applyTheme(monaco);
            if (editable) {
              const mod = editor.getModifiedEditor();
              mod.onDidChangeModelContent(() => {
                updateBuffer(view.workspacePath, mod.getValue());
              });
            }
          }}
          options={{
            fontSize: 13,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: !editable,
            originalEditable: false,
            renderSideBySide: true,
            wordWrap: "on",
            padding: { top: 8 },
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff…
            </div>
          }
        />
      </div>
    </div>
  );
}

function EmptyEditor() {
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <p className="text-lg font-medium text-foreground/80">JABL</p>
      <p className="max-w-md text-sm">
        Create a new file from a template, open a folder, or load Samples — then
        edit{" "}
        <code className="text-[var(--ide-keyword)]">.p</code>,{" "}
        <code className="text-[var(--ide-keyword)]">.cls</code>, and other ABL
        files.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => openNewFileDialog()}
      >
        <FilePlus className="size-3.5" />
        New File
      </Button>
      <p className="text-xs opacity-70">
        File → New File… or Ctrl/Cmd+N · Ctrl/Cmd+S to save
      </p>
    </div>
  );
}
