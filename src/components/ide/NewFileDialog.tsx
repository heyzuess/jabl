"use client";

import { useEffect, useMemo, useState } from "react";
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
  ensureTemplateExtension,
  getTemplate,
  languageForFilename,
  type AblTemplateId,
} from "@/lib/abl/templates";
import { listDirectoryPaths } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

type NewFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewFileDialog({ open, onOpenChange }: NewFileDialogProps) {
  const createNewFile = useWorkspaceStore((s) => s.createNewFile);
  const createUntitledFile = useWorkspaceStore((s) => s.createUntitledFile);
  const root = useWorkspaceStore((s) => s.root);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const newFileDefaultDir = useWorkspaceStore((s) => s.newFileDefaultDir);

  const dirOptions = useMemo(() => listDirectoryPaths(root), [root]);

  const [templateId, setTemplateId] = useState<AblTemplateId>("blank");
  const [filename, setFilename] = useState("untitled.p");
  const [filenameTouched, setFilenameTouched] = useState(false);
  const [dirPath, setDirPath] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId("blank");
    setFilename(getTemplate("blank").defaultFilename);
    setFilenameTouched(false);
    setDirPath(
      newFileDefaultDir || cwd || rootName || dirOptions[0] || ""
    );
    setCreating(false);
  }, [open, newFileDefaultDir, cwd, rootName, dirOptions]);

  const selectTemplate = (id: AblTemplateId) => {
    setTemplateId(id);
    const template = getTemplate(id);
    if (!filenameTouched) {
      setFilename(template.defaultFilename);
      return;
    }
    // Keep the typed stem; append template extension when none is present.
    setFilename(ensureTemplateExtension(filename, template));
  };

  const create = async () => {
    const template = getTemplate(templateId);
    const name = ensureTemplateExtension(
      filename.trim() || template.defaultFilename,
      template
    );
    setCreating(true);
    try {
      if (root && dirPath) {
        await createNewFile({
          name,
          content: template.content,
          language: languageForFilename(name),
          dirPath,
        });
      } else {
        createUntitledFile({
          name,
          content: template.content,
          language: languageForFilename(name),
          targetDir: dirPath || undefined,
        });
      }
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New file</DialogTitle>
          <DialogDescription>
            Pick a template and the directory under the open folder where the
            file should be created.
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

          {dirOptions.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="new-file-dir">Directory</Label>
              <select
                id="new-file-dir"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
              >
                {dirOptions.map((path) => (
                  <option key={path} value={path}>
                    {path}
                    {path === cwd ? " (cwd)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

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
          <Button
            variant="outline"
            disabled={creating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button disabled={creating} onClick={() => void create()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
