"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FilePlus,
  FolderOpen,
  Moon,
  Palette,
  Save,
  Sun,
  Files,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supportsDirectoryPicker } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [canPick, setCanPick] = useState(false);
  const openFolderViaPicker = useWorkspaceStore((s) => s.openFolderViaPicker);
  const openFolderViaInput = useWorkspaceStore((s) => s.openFolderViaInput);
  const loadSamples = useWorkspaceStore((s) => s.loadSamples);
  const saveActive = useWorkspaceStore((s) => s.saveActive);
  const openNewFileDialog = useWorkspaceStore((s) => s.openNewFileDialog);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const fsMode = useWorkspaceStore((s) => s.mode);

  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const terminalVisible = useLayoutStore((s) => s.terminalVisible);
  const sidebarSide = useLayoutStore((s) => s.sidebarSide);
  const panelPosition = useLayoutStore((s) => s.panelPosition);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const toggleTerminal = useLayoutStore((s) => s.toggleTerminal);
  const setSidebarSide = useLayoutStore((s) => s.setSidebarSide);
  const setPanelPosition = useLayoutStore((s) => s.setPanelPosition);
  const restoreLayout = useLayoutStore((s) => s.restoreLayout);
  const maximized = useLayoutStore((s) => s.maximized);

  useEffect(() => {
    const pick = supportsDirectoryPicker();
    setCanPick(pick);
    const input = inputRef.current;
    if (input && !pick) {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    }
  }, []);

  // Global shortcuts: Ctrl/Cmd+N = New File (Save also handled in EditorPane)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        openNewFileDialog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewFileDialog]);

  const isDirty = activePath ? !!dirty[activePath] : false;

  const openFolder = () => {
    if (canPick) void openFolderViaPicker();
    else inputRef.current?.click();
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
            <DropdownMenuLabel>Panes</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={sidebarVisible}
              onCheckedChange={() => toggleSidebar()}
            >
              Explorer
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked disabled>
              Editor
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={terminalVisible}
              onCheckedChange={() => toggleTerminal()}
            >
              Terminal
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
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

        <input
          ref={inputRef}
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
