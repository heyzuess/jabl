"use client";

import { useRef } from "react";
import {
  FolderOpen,
  Moon,
  Palette,
  Save,
  Sun,
  Files,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supportsDirectoryPicker } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
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
  const openFolderViaPicker = useWorkspaceStore((s) => s.openFolderViaPicker);
  const openFolderViaInput = useWorkspaceStore((s) => s.openFolderViaInput);
  const loadSamples = useWorkspaceStore((s) => s.loadSamples);
  const saveActive = useWorkspaceStore((s) => s.saveActive);
  const activePath = useWorkspaceStore((s) => s.activePath);
  const dirty = useWorkspaceStore((s) => s.dirty);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const fsMode = useWorkspaceStore((s) => s.mode);

  const isDirty = activePath ? !!dirty[activePath] : false;
  const canPick = typeof window !== "undefined" && supportsDirectoryPicker();

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-[var(--ide-chrome)] px-3">
      <div className="flex items-center gap-2 pr-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          JABL
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          OpenEdge ABL IDE
        </span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            if (canPick) void openFolderViaPicker();
            else inputRef.current?.click();
          }}
        >
          <FolderOpen className="size-3.5" />
          Open Folder
        </Button>
        {!canPick && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => inputRef.current?.click()}
          >
            Browse…
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          {...{ webkitdirectory: "", directory: "" }}
          onChange={(e) => {
            if (e.target.files?.length) {
              void openFolderViaInput(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void loadSamples()}
        >
          <Files className="size-3.5" />
          Samples
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={!activePath}
          onClick={() => void saveActive()}
        >
          <Save className="size-3.5" />
          Save
          {isDirty ? " *" : ""}
        </Button>
      </div>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
        {rootName && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {rootName}
            {fsMode === "readonly-input" ? " (read-only)" : ""}
            {statusMessage ? ` · ${statusMessage}` : ""}
          </span>
        )}
        {!rootName && statusMessage && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {statusMessage}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {mode === "dark" ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Theme settings"
          onClick={onOpenThemeSettings}
        >
          <Palette className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}
