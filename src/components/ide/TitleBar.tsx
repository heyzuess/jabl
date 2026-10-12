"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bug,
  ChevronDown,
  FilePlus,
  FileUp,
  FolderOpen,
  Moon,
  Palette,
  Play,
  Save,
  ScanSearch,
  Sun,
  Files,
  GitBranch,
  Hammer,
} from "lucide-react";
import { languageIdForPath } from "@/lib/abl/register";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  supportsDirectoryPicker,
  supportsOpenFilePicker,
} from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import {
  MAX_EDITOR_GROUPS,
  useEditorLayoutStore,
} from "@/lib/workspace/editor-layout-store";
import { executeAbl } from "@/lib/oe/execute";
import type { ThemeMode } from "@/lib/theme/themes";

type TitleBarProps = {
  mode: ThemeMode;
  onToggleTheme: () => void;
  onOpenThemeSettings: () => void;
};

export function TitleBar({
  mode,
  onToggleTheme,
  onOpenThemeSettings,
}: TitleBarProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canPickFolder] = useState(() =>
    typeof window !== "undefined" ? supportsDirectoryPicker() : false
  );
  const [canPickFile] = useState(() =>
    typeof window !== "undefined" ? supportsOpenFilePicker() : false
  );
  const openFolderViaPicker = useWorkspaceStore((s) => s.openFolderViaPicker);
  const openFolderViaInput = useWorkspaceStore((s) => s.openFolderViaInput);
  const openLocalFileViaPicker = useWorkspaceStore(
    (s) => s.openLocalFileViaPicker
  );
  const openLocalFilesViaInput = useWorkspaceStore(
    (s) => s.openLocalFilesViaInput
  );
  const loadSamples = useWorkspaceStore((s) => s.loadSamples);
  const saveActive = useWorkspaceStore((s) => s.saveActive);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const injectTerminal = useWorkspaceStore((s) => s.injectTerminal);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const fsMode = useWorkspaceStore((s) => s.mode);
  const canDebugAbl =
    !!activePath && languageIdForPath(activePath) === "abl";
  const canRunAbl = canDebugAbl;

  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const documentationVisible = useLayoutStore((s) => s.documentationVisible);
  const outputVisible = useLayoutStore((s) => s.outputVisible);
  const sidebarSide = useLayoutStore((s) => s.sidebarSide);
  const panelPosition = useLayoutStore((s) => s.panelPosition);
  const docsPosition = useLayoutStore((s) => s.docsPosition);
  const outputPosition = useLayoutStore((s) => s.outputPosition);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const revealSourceControl = useLayoutStore((s) => s.revealSourceControl);
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  const toggleTerminal = useLayoutStore((s) => s.toggleTerminal);
  const toggleDocumentation = useLayoutStore((s) => s.toggleDocumentation);
  const toggleOutput = useLayoutStore((s) => s.toggleOutput);
  const setSidebarSide = useLayoutStore((s) => s.setSidebarSide);
  const setPanelPosition = useLayoutStore((s) => s.setPanelPosition);
  const setDocsPosition = useLayoutStore((s) => s.setDocsPosition);
  const setOutputPosition = useLayoutStore((s) => s.setOutputPosition);
  const restoreLayout = useLayoutStore((s) => s.restoreLayout);
  const maximized = useLayoutStore((s) => s.maximized);
  const splitFocused = useEditorLayoutStore((s) => s.splitFocused);
  const editorLeafCount = useEditorLayoutStore((s) => {
    const countLeaves = (node: typeof s.root): number =>
      node.type === "leaf"
        ? 1
        : node.children.reduce((n, c) => n + countLeaves(c), 0);
    return countLeaves(s.root);
  });
  const canSplitEditor = editorLeafCount < MAX_EDITOR_GROUPS;

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (folderInput && !canPickFolder) {
      folderInput.setAttribute("webkitdirectory", "");
      folderInput.setAttribute("directory", "");
    }
  }, [canPickFolder]);

  // Global shortcuts: Ctrl/Cmd+N = New File, Ctrl/Cmd+O = Open File
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        openNewFileDialog();
      } else if (key === "o") {
        e.preventDefault();
        if (canPickFile) void openLocalFileViaPicker();
        else fileInputRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewFileDialog, canPickFile, openLocalFileViaPicker]);

  const openLocalFile = () => {
    if (canPickFile) void openLocalFileViaPicker();
    else fileInputRef.current?.click();
  };

  const isDirty = activePath ? !!dirty[activePath] : false;

  const openFolder = () => {
    if (canPickFolder) void openFolderViaPicker();
    else folderInputRef.current?.click();
  };

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-[var(--ide-chrome)] px-3">
      <div className="flex shrink-0 items-center gap-2 pr-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          JABL
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          OpenEdge ABL IDE
        </span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
              />
            }
          >
            File
            <ChevronDown className="size-3 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem onClick={() => openNewFileDialog()}>
              <FilePlus className="size-3.5" />
              New File…
              <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openLocalFile}>
              <FileUp className="size-3.5" />
              Open File…
              <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openFolder}>
              <FolderOpen className="size-3.5" />
              Open Folder…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void loadSamples()}>
              <Files className="size-3.5" />
              Load Samples
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!activePath}
              onClick={() => void saveActive()}
            >
              <Save className="size-3.5" />
              Save{isDirty ? " *" : ""}
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
              />
            }
          >
            View
            <ChevronDown className="size-3 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Panes</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={sidebarVisible && sidebarView === "explorer"}
                onCheckedChange={() => toggleSidebar()}
              >
                Explorer
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onClick={() => revealSourceControl()}>
                <GitBranch className="size-3.5" />
                Source Control
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked disabled>
                Editor
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={terminalVisible}
                onCheckedChange={() => toggleTerminal()}
              >
                Terminal
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={documentationVisible}
                onCheckedChange={() => toggleDocumentation()}
              >
                Documentation
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={outputVisible}
                onCheckedChange={() => toggleOutput()}
              >
                Output
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Editor</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!canSplitEditor}
                onClick={() => splitFocused("right")}
              >
                Split Right
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canSplitEditor}
                onClick={() => splitFocused("down")}
              >
                Split Down
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Layout</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={sidebarSide === "left" && sidebarVisible}
                onClick={() => setSidebarSide("left")}
              >
                Move Explorer Left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={sidebarSide === "right" && sidebarVisible}
                onClick={() => setSidebarSide("right")}
              >
                Move Explorer Right
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={panelPosition === "bottom" && terminalVisible}
                onClick={() => setPanelPosition("bottom")}
              >
                Move Terminal Bottom
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={panelPosition === "left" && terminalVisible}
                onClick={() => setPanelPosition("left")}
              >
                Move Terminal Left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={panelPosition === "right" && terminalVisible}
                onClick={() => setPanelPosition("right")}
              >
                Move Terminal Right
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={docsPosition === "bottom" && documentationVisible}
                onClick={() => setDocsPosition("bottom")}
              >
                Move Documentation Bottom
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={docsPosition === "left" && documentationVisible}
                onClick={() => setDocsPosition("left")}
              >
                Move Documentation Left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={docsPosition === "right" && documentationVisible}
                onClick={() => setDocsPosition("right")}
              >
                Move Documentation Right
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={outputPosition === "bottom" && outputVisible}
                onClick={() => setOutputPosition("bottom")}
              >
                Move Output Bottom
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={outputPosition === "left" && outputVisible}
                onClick={() => setOutputPosition("left")}
              >
                Move Output Left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={outputPosition === "right" && outputVisible}
                onClick={() => setOutputPosition("right")}
              >
                Move Output Right
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {maximized && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => restoreLayout()}>
                  Restore Layout
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
              />
            }
          >
            Run
            <ChevronDown className="size-3 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem
              disabled={!canRunAbl}
              onClick={() => void executeAbl("compile")}
            >
              <Hammer className="size-3.5" />
              Compile
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canRunAbl}
              onClick={() => void executeAbl("run")}
            >
              <Play className="size-3.5" />
              Run
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
              />
            }
          >
            Debug
            <ChevronDown className="size-3 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem
              disabled={!canDebugAbl}
              onClick={() => injectTerminal("check")}
            >
              <ScanSearch className="size-3.5" />
              Check Syntax
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canDebugAbl}
              onClick={() => injectTerminal("debug")}
            >
              <Bug className="size-3.5" />
              Start Debugger
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              void openFolderViaInput(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".p,.w,.i,.cls,.df,.abl,.txt,.md,.json,.xml,.sql,.css,.js,.ts,.tsx,.jsx"
          onChange={(e) => {
            if (e.target.files?.length) {
              void openLocalFilesViaInput(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void loadSamples()}
        >
          <Files className="size-3.5" />
          Samples
        </Button>
      </div>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
        {(rootName || statusMessage) && (
          <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
            {rootName}
            {fsMode === "readonly-input" ? " (read-only)" : ""}
            {statusMessage ? ` · ${statusMessage}` : ""}
          </span>
        )}
        <button
          type="button"
          aria-label="Toggle theme"
          title={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-foreground hover:bg-muted"
          onClick={onToggleTheme}
        >
          {mode === "dark" ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
          <span>{mode === "dark" ? "Light" : "Dark"}</span>
        </button>
        <button
          type="button"
          aria-label="Theme settings"
          title="Theme settings"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-foreground hover:bg-muted"
          onClick={onOpenThemeSettings}
        >
          <Palette className="size-3.5" />
          <span>Theme</span>
        </button>
      </div>
    </header>
  );
}
