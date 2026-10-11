"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  Maximize2,
  Minimize2,
  PanelBottomClose,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLayoutStore,
  type DockablePane,
  type PaneId,
  type SnapZone,
} from "@/lib/workspace/layout-store";

type PaneChromeProps = {
  pane: PaneId;
  title: string;
  children?: ReactNode;
  /** Extra controls on the left of the action buttons (e.g. New File) */
  actions?: ReactNode;
  className?: string;
  /** When true, only Expand/Restore is shown (editor) */
  editorMode?: boolean;
};

export function PaneChrome({
  pane,
  title,
  children,
  actions,
  className,
  editorMode = false,
}: PaneChromeProps) {
  const maximized = useLayoutStore((s) => s.maximized);
  const minimized = useLayoutStore((s) => s.minimized);
  const toggleMaximize = useLayoutStore((s) => s.toggleMaximize);
  const minimizePane = useLayoutStore((s) => s.minimizePane);
  const expandMinimized = useLayoutStore((s) => s.expandMinimized);
  const closePane = useLayoutStore((s) => s.closePane);
  const startPaneDrag = useLayoutStore((s) => s.startPaneDrag);
  const updateSnapTarget = useLayoutStore((s) => s.updateSnapTarget);
  const endPaneDrag = useLayoutStore((s) => s.endPaneDrag);

  const isMaximized = maximized === pane;
  const isMinimized =
    pane === "explorer"
      ? minimized.explorer
      : pane === "terminal"
        ? minimized.terminal
        : pane === "documentation"
          ? minimized.documentation
          : pane === "output"
            ? minimized.output
            : false;

  const canDock =
    pane === "explorer" ||
    pane === "terminal" ||
    pane === "documentation" ||
    pane === "output";

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDock || editorMode) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startPaneDrag(pane as DockablePane);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDock) return;
    const dragging = useLayoutStore.getState().draggingPane;
    if (dragging !== pane) return;
    const el = document.getElementById("ide-layout-body");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const zone = hitTestSnapZone(
      x,
      y,
      rect.width,
      rect.height,
      pane as DockablePane
    );
    updateSnapTarget(zone);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDock) return;
    const dragging = useLayoutStore.getState().draggingPane;
    if (dragging !== pane) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    endPaneDrag(true);
  };

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-1 border-b border-border px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        canDock && "cursor-grab active:cursor-grabbing",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => endPaneDrag(false)}
    >
      <span className="min-w-0 truncate px-1 select-none">{title}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        {children}
        {actions}
        {!editorMode && (
          <ChromeButton
            label={isMinimized ? "Expand pane" : "Minimize pane"}
            onClick={() => {
              if (pane === "editor") return;
              if (isMinimized) expandMinimized(pane);
              else minimizePane(pane);
            }}
          >
            {isMinimized ? (
              <PanelBottomClose className="size-3.5 rotate-180" />
            ) : (
              <Minimize2 className="size-3.5" />
            )}
          </ChromeButton>
        )}
        <ChromeButton
          label={isMaximized ? "Restore pane" : "Expand pane"}
          onClick={() => toggleMaximize(pane)}
        >
          {isMaximized ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </ChromeButton>
        {!editorMode && (
          <ChromeButton
            label="Close pane"
            onClick={() => closePane(pane)}
          >
            <X className="size-3.5" />
          </ChromeButton>
        )}
      </div>
    </div>
  );
}

function ChromeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex size-6 items-center justify-center rounded-md text-foreground hover:bg-accent"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}

export function hitTestSnapZone(
  x: number,
  y: number,
  w: number,
  h: number,
  pane: DockablePane
): SnapZone | null {
  const edge = Math.min(72, w * 0.18, h * 0.22);
  if (y > h - edge) return "bottom";
  if (x < edge) return "left";
  if (x > w - edge) return "right";
  if (pane === "explorer") {
    if (x < w * 0.45) return "center-left";
    if (x > w * 0.55) return "center-right";
    return null;
  }
  if (x < w * 0.45) return "center-left";
  if (x > w * 0.55) return "center-right";
  return null;
}
