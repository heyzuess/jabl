"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  Group,
  Panel,
  Separator as ResizeSeparator,
} from "react-resizable-panels";
import { TitleBar } from "./TitleBar";
import { FileExplorer } from "./FileExplorer";
import { EditorPane } from "./EditorPane";
import { TerminalPane } from "./TerminalPane";
import { ThemeSettings } from "./ThemeSettings";
import { useIdeTheme } from "@/hooks/use-theme";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { TooltipProvider } from "@/components/ui/tooltip";

export function IdeShell() {
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

  useEffect(() => {
    if (hydrated && mode === "none") {
      void loadSamples();
    }
  }, [hydrated, mode, loadSamples]);

  const themeKey = `${theme.mode}-${theme.custom.editorBackground}-${theme.custom.keyword}-${theme.custom.comment}-${theme.custom.accent}-${theme.custom.editorForeground}`;

  return (
    <TooltipProvider>
      <div
        className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
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
          } as CSSProperties
        }
      >
        <TitleBar
          mode={theme.mode}
          onToggleTheme={toggleMode}
          onOpenThemeSettings={() => setSettingsOpen(true)}
        />

        <div className="min-h-0 flex-1">
          <Group orientation="horizontal" className="h-full">
            <Panel
              defaultSize={18}
              minSize={12}
              maxSize={40}
              className="min-w-[140px]"
            >
              <FileExplorer />
            </Panel>
            <ResizeSeparator className="w-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
            <Panel defaultSize={82} minSize={40}>
              <Group orientation="vertical" className="h-full">
                <Panel defaultSize={72} minSize={30}>
                  <EditorPane
                    applyTheme={applyToMonaco}
                    themeKey={themeKey}
                  />
                </Panel>
                <ResizeSeparator className="h-1 bg-border transition-colors hover:bg-[var(--ide-accent)] data-[separator=active]:bg-[var(--ide-accent)]" />
                <Panel defaultSize={28} minSize={12} collapsible>
                  <TerminalPane
                    mode={theme.mode}
                    editorBg={theme.custom.editorBackground}
                    editorFg={theme.custom.editorForeground}
                    accent={theme.custom.accent}
                  />
                </Panel>
              </Group>
            </Panel>
          </Group>
        </div>

        <ThemeSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          mode={theme.mode}
          custom={theme.custom}
          onUpdate={updateCustom}
          onReset={resetCustom}
          onToggleMode={toggleMode}
        />
      </div>
    </TooltipProvider>
  );
}
