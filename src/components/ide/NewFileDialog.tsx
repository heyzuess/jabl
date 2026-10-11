"use client";

import { useEffect, useState } from "react";
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
import {
  ABL_TEMPLATES,
  getTemplate,
  languageForFilename,
  type AblTemplateId,
} from "@/lib/abl/templates";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

type NewFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewFileDialog({ open, onOpenChange }: NewFileDialogProps) {
  const createUntitledFile = useWorkspaceStore((s) => s.createUntitledFile);
  const [templateId, setTemplateId] = useState<AblTemplateId>("blank");
  const [filename, setFilename] = useState("untitled.p");
  const [filenameTouched, setFilenameTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId("blank");
    setFilename(getTemplate("blank").defaultFilename);
    setFilenameTouched(false);
  }, [open]);

  const selectTemplate = (id: AblTemplateId) => {
    setTemplateId(id);
    if (!filenameTouched) {
      setFilename(getTemplate(id).defaultFilename);
    }
  };

  const create = () => {
    const template = getTemplate(templateId);
    const name = filename.trim() || template.defaultFilename;
    createUntitledFile({
      name,
      content: template.content,
      language: languageForFilename(name),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New file</DialogTitle>
          <DialogDescription>
            Create an unsaved editor tab. Pick a template, then Save to choose a
            directory (defaults to the open folder cwd).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="new-file-name">Filename</Label>
            <Input
              id="new-file-name"
              value={filename}
              onChange={(e) => {
                setFilenameTouched(true);
                setFilename(e.target.value);
              }}
              className="font-mono text-xs"
              placeholder="untitled.p"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Template</Label>
            <div className="grid gap-1.5">
              {ABL_TEMPLATES.map((t) => {
                const selected = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTemplate(t.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition-colors",
                      selected
                        ? "border-[var(--ide-accent)] bg-accent/60"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {t.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
