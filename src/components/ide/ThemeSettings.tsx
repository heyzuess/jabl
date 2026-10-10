"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ThemeCustomization, ThemeMode } from "@/lib/theme/themes";

type ThemeSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ThemeMode;
  custom: ThemeCustomization;
  onUpdate: (partial: Partial<ThemeCustomization>) => void;
  onReset: () => void;
  onToggleMode: () => void;
};

const FIELDS: { key: keyof ThemeCustomization; label: string }[] = [
  { key: "editorBackground", label: "Editor background" },
  { key: "editorForeground", label: "Editor foreground" },
  { key: "accent", label: "Accent" },
  { key: "comment", label: "Comment color" },
  { key: "keyword", label: "Keyword color" },
];

export function ThemeSettings({
  open,
  onOpenChange,
  mode,
  custom,
  onUpdate,
  onReset,
  onToggleMode,
}: ThemeSettingsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Theme settings</DialogTitle>
          <DialogDescription>
            Customize editor and shell colors. Preferences are saved in
            localStorage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Mode</Label>
            <Button variant="outline" size="sm" onClick={onToggleMode}>
              Switch to {mode === "dark" ? "light" : "dark"}
            </Button>
          </div>

          {FIELDS.map(({ key, label }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key}>{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  id={key}
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
                  value={normalizeHex(custom[key])}
                  onChange={(e) => onUpdate({ [key]: e.target.value })}
                />
                <Input
                  value={custom[key]}
                  onChange={(e) => onUpdate({ [key]: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onReset}>
            Reset defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalizeHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return "#000000";
}
