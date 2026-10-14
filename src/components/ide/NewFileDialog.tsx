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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ABL_TEMPLATES,
  ensureTemplateExtension,
  getTemplate,
  languageForFilename,
  type AblTemplateId,
} from "@/lib/abl/templates";
import {
  pickDirectory,
  supportsDirectoryPicker,
} from "@/lib/workspace/fs-access";
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
  const setStatus = useWorkspaceStore((s) => s.setStatus);

  const canBrowse = supportsDirectoryPicker();

  const [templateId, setTemplateId] = useState<AblTemplateId | null>(null);
  const [filename, setFilename] = useState("untitled.p");
  const [filenameTouched, setFilenameTouched] = useState(false);
  const [dirPath, setDirPath] = useState("");
  const [dirHandle, setDirHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [creating, setCreating] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId(null);
    setFilename(getTemplate("blank").defaultFilename);
    setFilenameTouched(false);
    setDirPath(newFileDefaultDir || cwd || rootName || "");
    setDirHandle(null);
    setCreating(false);
    setBrowsing(false);
  }, [open, newFileDefaultDir, cwd, rootName]);

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

  const useCwd = () => {
    setDirHandle(null);
    setDirPath(cwd || rootName || "");
  };

  const browseFolder = async () => {
    if (!canBrowse) {
      setStatus("Folder picker is not available in this browser.");
      return;
    }
    setBrowsing(true);
    try {
      const handle = await pickDirectory();
      if (!handle) return;
      setDirHandle(handle);
      setDirPath(handle.name);
    } catch (err) {
      setStatus(`Browse failed: ${(err as Error).message}`);
    } finally {
      setBrowsing(false);
    }
  };

  const create = async () => {
    const template = getTemplate(templateId ?? "blank");
    const name = ensureTemplateExtension(
      filename.trim() || template.defaultFilename,
      template
    );
    const language = languageForFilename(name);
    const trimmedDir = dirPath.trim();
    setCreating(true);
    try {
      if (dirHandle) {
        await createNewFile({
          name,
          content: template.content,
          language,
          dirPath: trimmedDir || dirHandle.name,
          dirHandle,
        });
      } else if (root && trimmedDir) {
        await createNewFile({
          name,
          content: template.content,
          language,
          dirPath: trimmedDir,
        });
      } else {
        createUntitledFile({
          name,
          content: template.content,
          language,
          targetDir: trimmedDir || undefined,
        });
      }
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  const selectedTemplate = templateId ? getTemplate(templateId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New file</DialogTitle>
          <DialogDescription>
            Pick a template and where to save the file — use the current working
            directory, type a path, or browse for a folder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:grid-cols-2 sm:gap-5">
          <div className="grid min-w-0 gap-4">
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
              <Label htmlFor="new-file-dir">Directory</Label>
              <Input
                id="new-file-dir"
                value={dirPath}
                onChange={(e) => {
                  setDirHandle(null);
                  setDirPath(e.target.value);
                }}
                className="font-mono text-xs"
                placeholder={cwd || "folder path"}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creating || browsing || !(cwd || rootName)}
                  onClick={useCwd}
                >
                  Use cwd
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creating || browsing || !canBrowse}
                  onClick={() => void browseFolder()}
                  title={
                    canBrowse
                      ? "Browse for a folder on your computer"
                      : "Folder picker not available in this browser"
                  }
                >
                  {browsing ? "Browsing…" : "Browse…"}
                </Button>
              </div>
              {dirHandle && (
                <p className="text-[11px] text-muted-foreground">
                  Saving into browsed folder{" "}
                  <span className="font-mono text-foreground">
                    {dirHandle.name}
                  </span>
                </p>
              )}
              {!dirHandle && cwd && dirPath === cwd && (
                <p className="text-[11px] text-muted-foreground">
                  Using current working directory
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Template</Label>
              <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-0.5">
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

          <div className="flex min-h-56 min-w-0 flex-col gap-2 sm:min-h-0">
            <Label>Preview</Label>
            <div className="relative min-h-56 flex-1 overflow-hidden rounded-md border border-border bg-[var(--ide-editor-bg)] sm:min-h-[22rem]">
              {selectedTemplate ? (
                <ScrollArea className="h-full">
                  <pre className="p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedTemplate.content}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-sm text-foreground/35">preview</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={creating || browsing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={creating || browsing}
            onClick={() => void create()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
