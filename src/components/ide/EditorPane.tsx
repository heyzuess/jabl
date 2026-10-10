"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { FilePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { registerAblLanguage } from "@/lib/abl/register";
import { MONACO_THEME_NAME } from "@/lib/theme/themes";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { PaneChrome } from "./PaneChrome";

type EditorPaneProps = {
  applyTheme: (monaco: typeof Monaco) => void;
  themeKey: string;
};

export function EditorPane({ applyTheme, themeKey }: EditorPaneProps) {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const buffers = useWorkspaceStore((s) => s.buffers);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const setActivePath = useWorkspaceStore((s) => s.setActivePath);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const updateBuffer = useWorkspaceStore((s) => s.updateBuffer);
  const saveActive = useWorkspaceStore((s) => s.saveActive);
  const reorderTabs = useWorkspaceStore((s) => s.reorderTabs);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const activeTab = openTabs.find((t) => t.path === activePath);
  const value = activePath ? (buffers[activePath] ?? "") : "";

  const handleMount: OnMount = useCallback(
    (_editor, monaco) => {
      monacoRef.current = monaco;
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
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveActive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive]);

  return (
    <div className="flex h-full flex-col bg-[var(--ide-editor-bg)]">
      <PaneChrome pane="editor" title="Editor" editorMode />
      <div className="flex h-9 shrink-0 items-end gap-px overflow-x-auto border-b border-border bg-[var(--ide-chrome)]">
        {openTabs.length === 0 && (
          <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
            No file open
          </div>
        )}
        {openTabs.map((tab, index) => {
          const active = tab.path === activePath;
          return (
            <div
              key={tab.path}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
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
                const from =
                  dragIndex ??
                  Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(from) && from !== index) {
                  reorderTabs(from, index);
                }
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
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
                onClick={() => setActivePath(tab.path)}
                title={
                  tab.unsaved
                    ? `Unsaved · ${tab.path}`
                    : tab.path
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
      </div>

      <div className="min-h-0 flex-1">
        {activeTab ? (
          <Editor
            path={activeTab.path}
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
