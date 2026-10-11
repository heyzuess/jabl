"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator as ResizeSeparator,
  usePanelRef,
} from "react-resizable-panels";
import { TitleBar } from "./TitleBar";
import { FileExplorer } from "./FileExplorer";
import { EditorSplitTree } from "./EditorSplitTree";
import { TerminalPane } from "./TerminalPane";
import { DocumentationPane } from "./DocumentationPane";
import { ThemeSettings } from "./ThemeSettings";
import { NewFileDialog } from "./NewFileDialog";
import { NewFolderDialog } from "./NewFolderDialog";
import { SaveFileDialog } from "./SaveFileDialog";
import { EdgeSnapOverlay } from "./EdgeSnapOverlay";
import { useIdeTheme } from "@/hooks/use-theme";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
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
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const documentationVisible = useLayoutStore((s) => s.documentationVisible);
  const sidebarSide = useLayoutStore((s) => s.sidebarSide);
  const panelPosition = useLayoutStore((s) => s.panelPosition);
  const docsPosition = useLayoutStore((s) => s.docsPosition);
  const minimized = useLayoutStore((s) => s.minimized);

  useEffect(() => {
    if (hydrated && mode === "none") {
      void loadSamples();
    }
  }, [hydrated, mode, loadSamples]);

  const themeKey = `${theme.mode}-${theme.custom.editorBackground}-${theme.custom.keyword}-${theme.custom.comment}-${theme.custom.accent}-${theme.custom.editorForeground}`;

  const editor = (
    <EditorSplitTree applyTheme={applyToMonaco} themeKey={themeKey} />
  );
  const explorer = <FileExplorer />;
  const terminal = (
    <TerminalPane
      mode={theme.mode}
      editorBg={theme.custom.editorBackground}
      editorFg={theme.custom.editorForeground}
      accent={theme.custom.accent}
    />
  );
  const documentation = <DocumentationPane />;

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
          className="relative z-0 min-h-0 flex-1"
        >
          {maximized === "editor" && (
            <div className="h-full w-full overflow-hidden">{editor}</div>
          )}
          {maximized === "explorer" && (
            <div className="h-full w-full overflow-hidden">{explorer}</div>
          )}
          {maximized === "terminal" && (
            <div className="h-full w-full overflow-hidden">{terminal}</div>
          )}
          {maximized === "documentation" && (
            <div className="h-full w-full overflow-hidden">{documentation}</div>
          )}
          {!maximized && (
            <LayoutBody
              sidebarVisible={sidebarVisible}
              terminalVisible={terminalVisible}
              documentationVisible={documentationVisible}
              sidebarSide={sidebarSide}
              panelPosition={panelPosition}
              docsPosition={docsPosition}
              explorerMinimized={minimized.explorer}
              terminalMinimized={minimized.terminal}
              documentationMinimized={minimized.documentation}
              explorer={explorer}
              editor={editor}
              terminal={terminal}
              documentation={documentation}
            />
          )}
          <EdgeSnapOverlay />
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
  sidebarVisible: boolean;
  terminalVisible: boolean;
  documentationVisible: boolean;
  sidebarSide: "left" | "right";
  panelPosition: "bottom" | "right" | "left";
  docsPosition: "bottom" | "right" | "left";
  explorerMinimized: boolean;
  terminalMinimized: boolean;
  documentationMinimized: boolean;
  explorer: ReactNode;
  editor: ReactNode;
  terminal: ReactNode;
  documentation: ReactNode;
};

function LayoutBody({
  sidebarVisible,
  terminalVisible,
  documentationVisible,
  sidebarSide,
  panelPosition,
  docsPosition,
  explorerMinimized,
  terminalMinimized,
  documentationMinimized,
  explorer,
  editor,
  terminal,
  documentation,
}: LayoutBodyProps) {
  const docsOnSide =
    documentationVisible &&
    (docsPosition === "left" || docsPosition === "right");
  const docsOnBottom = documentationVisible && docsPosition === "bottom";

  const center = (
    <EditorTerminalDocsStack
      panelPosition={panelPosition}
      terminalVisible={terminalVisible}
      terminalMinimized={terminalMinimized}
      docsOnBottom={docsOnBottom}
      documentationMinimized={documentationMinimized}
      editor={editor}
      terminal={terminal}
      documentation={documentation}
    />
  );

  let main: ReactNode = center;

  if (sidebarVisible) {
    const sidebarPanel = (
      <CollapsiblePane
        id="explorer"
        defaultSize="22%"
        minSize="14%"
        maxSize="40%"
        collapsedSize="2rem"
        minimized={explorerMinimized}
      >
        {explorer}
      </CollapsiblePane>
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
      <ResizeSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
    );

    main = (
      <Group orientation="horizontal" className="h-full w-full">
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
      </Group>
    );
  }

  if (!docsOnSide) {
    return <div className="h-full w-full overflow-hidden">{main}</div>;
  }

  const docsPanel = (
    <CollapsiblePane
      id="documentation"
      defaultSize="28%"
      minSize="16%"
      maxSize="50%"
      collapsedSize="2rem"
      minimized={documentationMinimized}
    >
      {documentation}
    </CollapsiblePane>
  );

  const contentPanel = (
    <Panel
      id="content"
      defaultSize="72%"
      minSize="40%"
      className="min-h-0 overflow-hidden"
    >
      {main}
    </Panel>
  );

  const sep = (
    <ResizeSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
  );

  return (
    <Group orientation="horizontal" className="h-full w-full">
      {docsPosition === "left" ? (
        <>
          {docsPanel}
          {sep}
          {contentPanel}
        </>
      ) : (
        <>
          {contentPanel}
          {sep}
          {docsPanel}
        </>
      )}
    </Group>
  );
}

function EditorTerminalDocsStack({
  panelPosition,
  terminalVisible,
  terminalMinimized,
  docsOnBottom,
  documentationMinimized,
  editor,
  terminal,
  documentation,
}: {
  panelPosition: "bottom" | "right" | "left";
  terminalVisible: boolean;
  terminalMinimized: boolean;
  docsOnBottom: boolean;
  documentationMinimized: boolean;
  editor: ReactNode;
  terminal: ReactNode;
  documentation: ReactNode;
}) {
  const bottomExtras: ReactNode[] = [];
  if (terminalVisible && panelPosition === "bottom") {
    bottomExtras.push(
      <CollapsiblePane
        key="terminal"
        id="terminal"
        defaultSize={docsOnBottom ? "50%" : "28%"}
        minSize="12%"
        collapsedSize="2rem"
        minimized={terminalMinimized}
      >
        {terminal}
      </CollapsiblePane>
    );
  }
  if (docsOnBottom) {
    bottomExtras.push(
      <CollapsiblePane
        key="documentation-bottom"
        id="documentation-bottom"
        defaultSize={terminalVisible && panelPosition === "bottom" ? "50%" : "28%"}
        minSize="12%"
        collapsedSize="2rem"
        minimized={documentationMinimized}
      >
        {documentation}
      </CollapsiblePane>
    );
  }

  // Side-docked terminal (not bottom)
  const sideTerminal =
    terminalVisible && panelPosition !== "bottom" ? (
      <CollapsiblePane
        id="terminal"
        defaultSize="30%"
        minSize="12%"
        collapsedSize="2rem"
        minimized={terminalMinimized}
      >
        {terminal}
      </CollapsiblePane>
    ) : null;

  let editorRegion: ReactNode = (
    <div className="h-full w-full overflow-hidden">{editor}</div>
  );

  if (bottomExtras.length > 0) {
    const editorPanel = (
      <Panel
        id="editor"
        defaultSize="72%"
        minSize="30%"
        className="min-h-0 overflow-hidden"
      >
        {editor}
      </Panel>
    );

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
          <Group orientation="horizontal" className="h-full w-full">
            {bottomExtras[0]}
            <ResizeSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
            {bottomExtras[1]}
          </Group>
        </Panel>
      );

    editorRegion = (
      <Group orientation="vertical" className="h-full w-full">
        {editorPanel}
        <ResizeSeparator className="h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
        {bottomPanel}
      </Group>
    );
  }

  if (!sideTerminal) {
    return <div className="h-full w-full overflow-hidden">{editorRegion}</div>;
  }

  const editorPanel = (
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
    <ResizeSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
  );

  const terminalFirst = panelPosition === "left";

  return (
    <Group orientation="horizontal" className="h-full w-full">
      {terminalFirst ? (
        <>
          {sideTerminal}
          {sep}
          {editorPanel}
        </>
      ) : (
        <>
          {editorPanel}
          {sep}
          {sideTerminal}
        </>
      )}
    </Group>
  );
}

function CollapsiblePane({
  id,
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  minimized,
  children,
}: {
  id: string;
  defaultSize: string;
  minSize: string;
  maxSize?: string;
  collapsedSize: string;
  minimized: boolean;
  children: ReactNode;
}) {
  const panelRef = usePanelRef();

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (minimized) panel.collapse();
    else if (panel.isCollapsed()) panel.expand();
  }, [minimized, panelRef]);

  return (
    <Panel
      id={id}
      panelRef={panelRef}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsedSize={collapsedSize}
      collapsible
      className="min-h-0 overflow-hidden"
    >
      {children}
    </Panel>
  );
}
