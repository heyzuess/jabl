"use client";

import {
  BookOpen,
  Code2,
  Files,
  GitBranch,
  History,
  ScrollText,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLayoutStore,
  type PaneId,
} from "@/lib/workspace/layout-store";

const PANE_ORDER: PaneId[] = [
  "editor",
  "explorer",
  "terminal",
  "documentation",
  "output",
  "gitHistory",
];

function paneMeta(
  pane: PaneId,
  sidebarView: "explorer" | "scm"
): { label: string; icon: typeof Files } {
  switch (pane) {
    case "explorer":
      return sidebarView === "scm"
        ? { label: "Source Control", icon: GitBranch }
        : { label: "Explorer", icon: Files };
    case "editor":
      return { label: "Editor", icon: Code2 };
    case "terminal":
      return { label: "Terminal", icon: Terminal };
    case "documentation":
      return { label: "Documentation", icon: BookOpen };
    case "output":
      return { label: "Output", icon: ScrollText };
    case "gitHistory":
      return { label: "Git History", icon: History };
  }
}

export function MinimizedPaneBar() {
  const minimized = useLayoutStore((s) => s.minimized);
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  const expandMinimized = useLayoutStore((s) => s.expandMinimized);

  const panes = PANE_ORDER.filter((pane) => minimized[pane]);

  return (
    <aside
      className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--ide-chrome)] py-1"
      aria-label="Minimized panes"
    >
      {panes.map((pane) => {
        const { label, icon: Icon } = paneMeta(pane, sidebarView);
        return (
          <button
            key={pane}
            type="button"
            title={`Restore ${label}`}
            aria-label={`Restore ${label}`}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
              "hover:bg-accent hover:text-foreground"
            )}
            onClick={() => expandMinimized(pane)}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </aside>
  );
}
