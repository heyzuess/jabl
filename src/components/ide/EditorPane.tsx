"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerAblLanguage } from "@/lib/abl/register";
import { MONACO_THEME_NAME } from "@/lib/theme/themes";
import { useWorkspaceStore } from "@/lib/workspace/store";

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
      <div className="flex h-9 shrink-0 items-end gap-px overflow-x-auto border-b border-border bg-[var(--ide-chrome)]">
        {openTabs.length === 0 && (
          <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
            No file open
          </div>
        )}
        {openTabs.map((tab) => {
          const active = tab.path === activePath;
          return (
            <div
              key={tab.path}
              className={cn(
                "group flex h-8 max-w-[180px] items-center gap-1 border-r border-border px-2 text-xs",
                active
                  ? "bg-[var(--ide-editor-bg)] text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/40"
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => setActivePath(tab.path)}
                title={tab.path}
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
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <p className="text-lg font-medium text-foreground/80">JABL</p>
      <p className="max-w-md text-sm">
        Open a folder or load the sample ABL project, then select a{" "}
        <code className="text-[var(--ide-keyword)]">.p</code>,{" "}
        <code className="text-[var(--ide-keyword)]">.cls</code>, or other ABL
        file to edit.
      </p>
      <p className="text-xs opacity-70">
        Autocomplete: keywords, snippets, and built-in functions · Ctrl/Cmd+S
        to save
      </p>
    </div>
  );
}
