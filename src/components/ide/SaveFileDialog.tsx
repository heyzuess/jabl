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
import { listDirectoryPaths } from "@/lib/workspace/fs-access";
import { useWorkspaceStore } from "@/lib/workspace/store";

export function SaveFileDialog() {
  const saveFileDialog = useWorkspaceStore((s) => s.saveFileDialog);
  const setSaveFileDialogOpen = useWorkspaceStore((s) => s.setSaveFileDialogOpen);
  const saveActiveToDirectory = useWorkspaceStore((s) => s.saveActiveToDirectory);
  const saveActiveToOtherLocation = useWorkspaceStore(
    (s) => s.saveActiveToOtherLocation
  );
  const root = useWorkspaceStore((s) => s.root);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const rootName = useWorkspaceStore((s) => s.rootName);

  const dirOptions = useMemo(() => listDirectoryPaths(root), [root]);

  const [fileName, setFileName] = useState("untitled.p");
  const [dirPath, setDirPath] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saveFileDialog.open) return;
    setFileName(saveFileDialog.suggestedName || "untitled.p");
    setDirPath(
      saveFileDialog.defaultDir || cwd || rootName || dirOptions[0] || ""
    );
    setSaving(false);
  }, [saveFileDialog, cwd, rootName, dirOptions]);

  const onOpenChange = (open: boolean) => {
    if (!open) setSaveFileDialogOpen(false);
  };

  const save = async () => {
    if (!dirPath) return;
    setSaving(true);
    try {
      await saveActiveToDirectory(dirPath, fileName);
    } finally {
      setSaving(false);
    }
  };

  const saveOther = async () => {
    setSaving(true);
    try {
      await saveActiveToOtherLocation();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={saveFileDialog.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save file</DialogTitle>
          <DialogDescription>
            Choose a directory under the open folder. Defaults to the current
            working directory.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="save-file-name">Filename</Label>
            <Input
              id="save-file-name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="save-file-dir">Directory</Label>
            <select
              id="save-file-dir"
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
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void saveOther()}
          >
            Other location…
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setSaveFileDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !dirPath || !fileName.trim()}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
