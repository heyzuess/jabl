"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Panel } from "react-resizable-panels";
import { LayoutGroup, LayoutSeparator } from "./layout-panels";
import { TitleBar } from "./TitleBar";
import { FileExplorer } from "./FileExplorer";
import { SourceControlPane } from "./SourceControlPane";
import { EditorSplitTree } from "./EditorSplitTree";
import { TerminalPane } from "./TerminalPane";
import { DocumentationPane } from "./DocumentationPane";
import { OutputPane } from "./OutputPane";
import { GitHistoryPane } from "./GitHistoryPane";
import { MarkdownPreviewPane } from "./MarkdownPreviewPane";
import { MinimizedPaneBar } from "./MinimizedPaneBar";
import { ThemeSettings } from "./ThemeSettings";
import { NewFileDialog } from "./NewFileDialog";
import { NewFolderDialog } from "./NewFolderDialog";
import { SaveFileDialog } from "./SaveFileDialog";
import { EdgeSnapOverlay } from "./EdgeSnapOverlay";
import { useIdeTheme } from "@/hooks/use-theme";
import { useWorkspaceStore } from "@/lib/workspace/store";
import {
  sizeForPane,
  useLayoutStore,
} from "@/lib/workspace/layout-store";
import { TooltipProvider } from "@/components/ui/tooltip";

export function IdeShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#1e1e1e] text-sm text-[#d4d4d4]">
        Loading JABL…
      </div>
    );
  }

  return <IdeShellClient />;
}

function IdeShellClient() {
  const {
    theme,
    hydrated,
    toggleMode,
    updateCustom,
    resetCustom,
    applyToMonaco,
  } = useIdeTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadSamples = useWorkspaceStore((s) => s.loadSamples);
  const mode = useWorkspaceStore((s) => s.mode);
  const newFileDialogOpen = useWorkspaceStore((s) => s.newFileDialogOpen);
  const setNewFileDialogOpen = useWorkspaceStore((s) => s.setNewFileDialogOpen);

  const maximized = useLayoutStore((s) => s.maximized);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const documentationVisible = useLayoutStore((s) => s.documentationVisible);
  const outputVisible = useLayoutStore((s) => s.outputVisible);
  const gitHistoryVisible = useLayoutStore((s) => s.gitHistoryVisible);
  const previewVisible = useLayoutStore((s) => s.previewVisible);
  const editorVisible = useLayoutStore((s) => s.editorVisible);
  const sidebarSide = useLayoutStore((s) => s.sidebarSide);
  const panelPosition = useLayoutStore((s) => s.panelPosition);
  const docsPosition = useLayoutStore((s) => s.docsPosition);
  const outputPosition = useLayoutStore((s) => s.outputPosition);
  const gitHistoryPosition = useLayoutStore((s) => s.gitHistoryPosition);
  const previewPosition = useLayoutStore((s) => s.previewPosition);
  const minimized = useLayoutStore((s) => s.minimized);
  const paneSizes = useLayoutStore((s) => s.paneSizes);
  const revealPreview = useLayoutStore((s) => s.revealPreview);
  const activePath = useWorkspaceStore((s) => s.activePath);

  useEffect(() => {
    if (activePath && activePath.toLowerCase().endsWith(".md")) {
      revealPreview();
    }
  }, [activePath, revealPreview]);

  const autoLoadedSamples = useRef(false);
  useEffect(() => {
    if (!hydrated || autoLoadedSamples.current) return;
    autoLoadedSamples.current = true;
    if (mode === "none") void loadSamples();
  }, [hydrated, mode, loadSamples]);

  const themeKey = `${theme.mode}-${theme.custom.editorBackground}-${theme.custom.keyword}-${theme.custom.comment}-${theme.custom.accent}-${theme.custom.editorForeground}`;

  const editor = (
    <EditorSplitTree applyTheme={applyToMonaco} themeKey={themeKey} />
  );
  const explorer =
    sidebarView === "scm" ? <SourceControlPane /> : <FileExplorer />;
  const terminal = (
    <TerminalPane
      mode={theme.mode}
      editorBg={theme.custom.editorBackground}
      editorFg={theme.custom.editorForeground}
      accent={theme.custom.accent}
    />
  );
  const documentation = <DocumentationPane />;
  const output = <OutputPane />;
  const gitHistory = <GitHistoryPane />;
  const preview = <MarkdownPreviewPane />;

  const showExplorer = sidebarVisible && !minimized.explorer;
  const showEditor = editorVisible && !minimized.editor;
  const showTerminal = terminalVisible && !minimized.terminal;
  const showDocs = documentationVisible && !minimized.documentation;
  const showOutput = outputVisible && !minimized.output;
  const showGitHistory = gitHistoryVisible && !minimized.gitHistory;
  const showPreview = previewVisible && !minimized.preview;

  return (
    <TooltipProvider>
      <div
        className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
        data-theme={theme.mode}
        style={
          {
            "--ide-chrome":
              theme.mode === "dark" ? "#252526" : "#f3f3f3",
            "--ide-sidebar":
              theme.mode === "dark" ? "#1e1e1e" : "#f8f8f8",
            "--ide-editor-bg": theme.custom.editorBackground,
            "--ide-editor-fg": theme.custom.editorForeground,
            "--ide-accent": theme.custom.accent,
            "--ide-comment": theme.custom.comment,
            "--ide-keyword": theme.custom.keyword,
            backgroundColor:
              theme.mode === "dark" ? "#1e1e1e" : "#ffffff",
            color: theme.mode === "dark" ? "#d4d4d4" : "#1e1e1e",
          } as CSSProperties
        }
      >
        <TitleBar
          mode={theme.mode}
          onToggleTheme={toggleMode}
          onOpenThemeSettings={() => setSettingsOpen(true)}
        />

        <div
          id="ide-layout-body"
          className="relative z-0 flex min-h-0 flex-1"
        >
          <MinimizedPaneBar />
          <div className="relative min-h-0 min-w-0 flex-1">
            {maximized === "editor" && showEditor && (
              <div className="h-full w-full overflow-hidden">{editor}</div>
            )}
            {maximized === "explorer" && showExplorer && (
              <div className="h-full w-full overflow-hidden">{explorer}</div>
            )}
            {maximized === "terminal" && showTerminal && (
              <div className="h-full w-full overflow-hidden">{terminal}</div>
            )}
            {maximized === "documentation" && showDocs && (
              <div className="h-full w-full overflow-hidden">
                {documentation}
              </div>
            )}
            {maximized === "output" && showOutput && (
              <div className="h-full w-full overflow-hidden">{output}</div>
            )}
            {maximized === "gitHistory" && showGitHistory && (
              <div className="h-full w-full overflow-hidden">{gitHistory}</div>
            )}
            {maximized === "preview" && showPreview && (
              <div className="h-full w-full overflow-hidden">{preview}</div>
            )}
            {!maximized && (
              <LayoutBody
                showExplorer={showExplorer}
                showTerminal={showTerminal}
                showDocs={showDocs}
                showOutput={showOutput}
                showGitHistory={showGitHistory}
                showPreview={showPreview}
                showEditor={showEditor}
                sidebarSide={sidebarSide}
                panelPosition={panelPosition}
                docsPosition={docsPosition}
                outputPosition={outputPosition}
                gitHistoryPosition={gitHistoryPosition}
                previewPosition={previewPosition}
                paneSizes={paneSizes}
                explorer={explorer}
                editor={editor}
                terminal={terminal}
                documentation={documentation}
                output={output}
                gitHistory={gitHistory}
                preview={preview}
              />
            )}
            <EdgeSnapOverlay />
          </div>
        </div>

        <ThemeSettings
          open={settingsOpen}
          onOpenChange={(open) => setSettingsOpen(open)}
          mode={theme.mode}
          custom={theme.custom}
          onUpdate={updateCustom}
          onReset={resetCustom}
          onToggleMode={toggleMode}
        />
        <NewFileDialog
          open={newFileDialogOpen}
          onOpenChange={setNewFileDialogOpen}
        />
        <NewFolderDialog />
        <SaveFileDialog />
      </div>
    </TooltipProvider>
  );
}

type LayoutBodyProps = {
  showExplorer: boolean;
  showTerminal: boolean;
  showDocs: boolean;
  showOutput: boolean;
  showGitHistory: boolean;
  showPreview: boolean;
  showEditor: boolean;
  sidebarSide: "left" | "right";
  panelPosition: "bottom" | "right" | "left";
  docsPosition: "bottom" | "right" | "left";
  outputPosition: "bottom" | "right" | "left";
  gitHistoryPosition: "bottom" | "right" | "left";
  previewPosition: "bottom" | "right" | "left";
  paneSizes: Partial<
    Record<
      | "explorer"
      | "editor"
      | "terminal"
      | "documentation"
      | "output"
      | "gitHistory"
      | "preview",
      string
    >
  >;
  explorer: ReactNode;
  editor: ReactNode;
  terminal: ReactNode;
  documentation: ReactNode;
  output: ReactNode;
  gitHistory: ReactNode;
  preview: ReactNode;
};

function LayoutBody({
  showExplorer,
  showTerminal,
  showDocs,
  showOutput,
  showGitHistory,
  showPreview,
  showEditor,
  sidebarSide,
  panelPosition,
  docsPosition,
  outputPosition,
  gitHistoryPosition,
  previewPosition,
  paneSizes,
  explorer,
  editor,
  terminal,
  documentation,
  output,
  gitHistory,
  preview,
}: LayoutBodyProps) {
  const docsOnSide =
    showDocs && (docsPosition === "left" || docsPosition === "right");
  const outputOnSide =
    showOutput && (outputPosition === "left" || outputPosition === "right");
  const gitHistoryOnSide =
    showGitHistory &&
    (gitHistoryPosition === "left" || gitHistoryPosition === "right");
  const previewOnSide =
    showPreview &&
    (previewPosition === "left" || previewPosition === "right");
  const docsOnBottom = showDocs && docsPosition === "bottom";
  const outputOnBottom = showOutput && outputPosition === "bottom";
  const gitHistoryOnBottom = showGitHistory && gitHistoryPosition === "bottom";
  const previewOnBottom = showPreview && previewPosition === "bottom";

  const center = (
    <EditorBottomStack
      panelPosition={panelPosition}
      showTerminal={showTerminal}
      docsOnBottom={docsOnBottom}
      outputOnBottom={outputOnBottom}
      gitHistoryOnBottom={gitHistoryOnBottom}
      previewOnBottom={previewOnBottom}
      showEditor={showEditor}
      paneSizes={paneSizes}
      editor={editor}
      terminal={terminal}
      documentation={documentation}
      output={output}
      gitHistory={gitHistory}
      preview={preview}
    />
  );

  let main: ReactNode = center;

  if (showExplorer) {
    const sidebarPanel = (
      <Panel
        id="explorer"
        defaultSize={sizeForPane(paneSizes, "explorer", "22%")}
        minSize="14%"
        maxSize="40%"
        className="min-h-0 overflow-hidden"
      >
        {explorer}
      </Panel>
    );

    const mainPanel = (
      <Panel
        id="main"
        defaultSize="78%"
        minSize="40%"
        className="min-h-0 overflow-hidden"
      >
        {center}
      </Panel>
    );

    const sep = (
      <LayoutSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
    );

    main = (
      <LayoutGroup orientation="horizontal" className="h-full w-full">
        {sidebarSide === "left" ? (
          <>
            {sidebarPanel}
            {sep}
            {mainPanel}
          </>
        ) : (
          <>
            {mainPanel}
            {sep}
            {sidebarPanel}
          </>
        )}
      </LayoutGroup>
    );
  }

  const leftSide: {
    id: string;
    node: ReactNode;
    pane: "documentation" | "output" | "gitHistory" | "preview";
  }[] = [];
  const rightSide: {
    id: string;
    node: ReactNode;
    pane: "documentation" | "output" | "gitHistory" | "preview";
  }[] = [];

  if (docsOnSide) {
    const item = {
      id: "documentation",
      node: documentation,
      pane: "documentation" as const,
    };
    if (docsPosition === "left") leftSide.push(item);
    else rightSide.push(item);
  }
  if (outputOnSide) {
    const item = {
      id: "output",
      node: output,
      pane: "output" as const,
    };
    if (outputPosition === "left") leftSide.push(item);
    else rightSide.push(item);
  }
  if (gitHistoryOnSide) {
    const item = {
      id: "gitHistory",
      node: gitHistory,
      pane: "gitHistory" as const,
    };
    if (gitHistoryPosition === "left") leftSide.push(item);
    else rightSide.push(item);
  }
  if (previewOnSide) {
    const item = {
      id: "preview",
      node: preview,
      pane: "preview" as const,
    };
    if (previewPosition === "left") leftSide.push(item);
    else rightSide.push(item);
  }

  if (!leftSide.length && !rightSide.length) {
    return <div className="h-full w-full overflow-hidden">{main}</div>;
  }

  return (
    <LayoutGroup orientation="horizontal" className="h-full w-full">
      {leftSide.length > 0 && (
        <>
          <SidePaneStack panes={leftSide} paneSizes={paneSizes} />
          <LayoutSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
        </>
      )}
      <Panel
        id="content"
        defaultSize="72%"
        minSize="40%"
        className="min-h-0 overflow-hidden"
      >
        {main}
      </Panel>
      {rightSide.length > 0 && (
        <>
          <LayoutSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
          <SidePaneStack panes={rightSide} paneSizes={paneSizes} />
        </>
      )}
    </LayoutGroup>
  );
}

function SidePaneStack({
  panes,
  paneSizes,
}: {
  panes: {
    id: string;
    node: ReactNode;
    pane: "documentation" | "output" | "gitHistory" | "preview";
  }[];
  paneSizes: LayoutBodyProps["paneSizes"];
}) {
  if (panes.length === 1) {
    const p = panes[0]!;
    return (
      <Panel
        id={p.id}
        defaultSize={sizeForPane(paneSizes, p.pane, "28%")}
        minSize="16%"
        maxSize="50%"
        className="min-h-0 overflow-hidden"
      >
        {p.node}
      </Panel>
    );
  }

  const children: ReactNode[] = [];
  panes.forEach((p, i) => {
    if (i > 0) {
      children.push(
        <LayoutSeparator
          key={`side-sep-${p.id}`}
          className="h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]"
        />
      );
    }
    children.push(
      <Panel
        key={p.id}
        id={p.id}
        defaultSize={`${Math.floor(100 / panes.length)}%`}
        minSize="20%"
        className="min-h-0 overflow-hidden"
      >
        {p.node}
      </Panel>
    );
  });

  return (
    <Panel
      id={`side-stack-${panes.map((p) => p.id).join("-")}`}
      defaultSize={sizeForPane(paneSizes, panes[0]!.pane, "28%")}
      minSize="16%"
      maxSize="50%"
      className="min-h-0 overflow-hidden"
    >
      <LayoutGroup orientation="vertical" className="h-full w-full">
        {children}
      </LayoutGroup>
    </Panel>
  );
}

function EditorBottomStack({
  panelPosition,
  showTerminal,
  docsOnBottom,
  outputOnBottom,
  gitHistoryOnBottom,
  previewOnBottom,
  showEditor,
  paneSizes,
  editor,
  terminal,
  documentation,
  output,
  gitHistory,
  preview,
}: {
  panelPosition: "bottom" | "right" | "left";
  showTerminal: boolean;
  docsOnBottom: boolean;
  outputOnBottom: boolean;
  gitHistoryOnBottom: boolean;
  previewOnBottom: boolean;
  showEditor: boolean;
  paneSizes: LayoutBodyProps["paneSizes"];
  editor: ReactNode;
  terminal: ReactNode;
  documentation: ReactNode;
  output: ReactNode;
  gitHistory: ReactNode;
  preview: ReactNode;
}) {
  const bottomExtras: ReactNode[] = [];
  if (showTerminal && panelPosition === "bottom") {
    bottomExtras.push(
      <Panel
        key="terminal"
        id="terminal"
        defaultSize={sizeForPane(paneSizes, "terminal", "28%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {terminal}
      </Panel>
    );
  }
  if (docsOnBottom) {
    bottomExtras.push(
      <Panel
        key="documentation-bottom"
        id="documentation-bottom"
        defaultSize={sizeForPane(paneSizes, "documentation", "28%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {documentation}
      </Panel>
    );
  }
  if (outputOnBottom) {
    bottomExtras.push(
      <Panel
        key="output-bottom"
        id="output-bottom"
        defaultSize={sizeForPane(paneSizes, "output", "28%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {output}
      </Panel>
    );
  }
  if (gitHistoryOnBottom) {
    bottomExtras.push(
      <Panel
        key="gitHistory-bottom"
        id="gitHistory-bottom"
        defaultSize={sizeForPane(paneSizes, "gitHistory", "28%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {gitHistory}
      </Panel>
    );
  }
  if (previewOnBottom) {
    bottomExtras.push(
      <Panel
        key="preview-bottom"
        id="preview-bottom"
        defaultSize={sizeForPane(paneSizes, "preview", "28%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {preview}
      </Panel>
    );
  }

  const sideTerminal =
    showTerminal && panelPosition !== "bottom" ? (
      <Panel
        id="terminal"
        defaultSize={sizeForPane(paneSizes, "terminal", "30%")}
        minSize="12%"
        className="min-h-0 overflow-hidden"
      >
        {terminal}
      </Panel>
    ) : null;

  const editorPanel = showEditor ? (
    <Panel
      key="editor"
      id="editor"
      defaultSize={
        bottomExtras.length > 0
          ? sizeForPane(paneSizes, "editor", "72%")
          : "100%"
      }
      minSize="12%"
      className="min-h-0 overflow-hidden"
    >
      {editor}
    </Panel>
  ) : null;

  let editorRegion: ReactNode;

  if (editorPanel && bottomExtras.length > 0) {
    const bottomPanel =
      bottomExtras.length === 1 ? (
        bottomExtras[0]
      ) : (
        <Panel
          id="bottom-stack"
          defaultSize="28%"
          minSize="16%"
          className="min-h-0 overflow-hidden"
        >
          <LayoutGroup orientation="horizontal" className="h-full w-full">
            {bottomExtras.flatMap((node, i) =>
              i === 0
                ? [node]
                : [
                    <LayoutSeparator
                      key={`sep-${i}`}
                      className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]"
                    />,
                    node,
                  ]
            )}
          </LayoutGroup>
        </Panel>
      );

    editorRegion = (
      <LayoutGroup orientation="vertical" className="h-full w-full">
        {editorPanel}
        <LayoutSeparator className="h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
        {bottomPanel}
      </LayoutGroup>
    );
  } else if (editorPanel) {
    editorRegion = (
      <LayoutGroup orientation="vertical" className="h-full w-full">
        {editorPanel}
      </LayoutGroup>
    );
  } else if (bottomExtras.length > 0) {
    editorRegion =
      bottomExtras.length === 1 ? (
        <LayoutGroup orientation="vertical" className="h-full w-full">
          {bottomExtras[0]}
        </LayoutGroup>
      ) : (
        <LayoutGroup orientation="horizontal" className="h-full w-full">
          {bottomExtras.flatMap((node, i) =>
            i === 0
              ? [node]
              : [
                  <LayoutSeparator
                    key={`sep-${i}`}
                    className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]"
                  />,
                  node,
                ]
          )}
        </LayoutGroup>
      );
  } else {
    editorRegion = <div className="h-full w-full overflow-hidden" />;
  }

  if (!sideTerminal) {
    return <div className="h-full w-full overflow-hidden">{editorRegion}</div>;
  }

  const centerPanel = (
    <Panel
      id="editor-region"
      defaultSize="70%"
      minSize="30%"
      className="min-h-0 overflow-hidden"
    >
      {editorRegion}
    </Panel>
  );

  const sep = (
    <LayoutSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
  );

  const terminalFirst = panelPosition === "left";

  return (
    <LayoutGroup orientation="horizontal" className="h-full w-full">
      {terminalFirst ? (
        <>
          {sideTerminal}
          {sep}
          {centerPanel}
        </>
      ) : (
        <>
          {centerPanel}
          {sep}
          {sideTerminal}
        </>
      )}
    </LayoutGroup>
  );
}
