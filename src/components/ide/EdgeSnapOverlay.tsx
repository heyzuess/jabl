"use client";

import { cn } from "@/lib/utils";
import {
  useLayoutStore,
  type SnapZone,
} from "@/lib/workspace/layout-store";

const ZONES: {
  id: SnapZone;
  className: string;
  label: string;
}[] = [
  {
    id: "left",
    className: "left-2 top-1/2 h-[55%] w-14 -translate-y-1/2",
    label: "Snap left",
  },
  {
    id: "right",
    className: "right-2 top-1/2 h-[55%] w-14 -translate-y-1/2",
    label: "Snap right",
  },
  {
    id: "bottom",
    className: "bottom-2 left-1/2 h-14 w-[55%] -translate-x-1/2",
    label: "Snap bottom",
  },
  {
    id: "center-left",
    className: "left-[22%] top-1/2 h-[40%] w-12 -translate-y-1/2",
    label: "Dock left of editor",
  },
  {
    id: "center-right",
    className: "right-[22%] top-1/2 h-[40%] w-12 -translate-y-1/2",
    label: "Dock right of editor",
  },
];

export function EdgeSnapOverlay() {
  const draggingPane = useLayoutStore((s) => s.draggingPane);
  const snapTarget = useLayoutStore((s) => s.snapTarget);

  if (!draggingPane) return null;

  // Explorer: left/right; Terminal / Documentation: all zones
  const visible =
    draggingPane === "explorer"
      ? ZONES.filter((z) => z.id === "left" || z.id === "right")
      : ZONES;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      aria-hidden
    >
      {visible.map((zone) => {
        const active = snapTarget === zone.id;
        return (
          <div
            key={zone.id}
            className={cn(
              "absolute rounded-md border-2 border-dashed transition-all duration-150",
              zone.className,
              active
                ? "border-[var(--ide-accent)] bg-[var(--ide-accent)]/35 shadow-lg"
                : "border-foreground/30 bg-foreground/10"
            )}
            title={zone.label}
          />
        );
      })}
      {snapTarget && (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow ring-1 ring-border">
            Drop to snap {draggingPane} · {snapTarget.replace("-", " ")}
          </span>
        </div>
      )}
    </div>
  );
}
