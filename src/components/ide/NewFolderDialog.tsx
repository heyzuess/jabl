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

export function NewFolderDialog() {
  const open = useWorkspaceStore((s) => s.newFolderDialogOpen);
  const setOpen = useWorkspaceStore((s) => s.setNewFolderDialogOpen);
  const createNewFolder = useWorkspaceStore((s) => s.createNewFolder);
  const root = useWorkspaceStore((s) => s.root);
  const cwd = useWorkspaceStore((s) => s.cwd);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const newFolderDefaultDir = useWorkspaceStore((s) => s.newFolderDefaultDir);

  const dirOptions = useMemo(() => listDirectoryPaths(root), [root]);
  const [name, setName] = useState("new-folder");
  const [parentDir, setParentDir] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("new-folder");
    setParentDir(
      newFolderDefaultDir || cwd || rootName || dirOptions[0] || ""
    );
    setCreating(false);
  }, [open, newFolderDefaultDir, cwd, rootName, dirOptions]);

  const create = async () => {
    if (!parentDir || !name.trim()) return;
    setCreating(true);
    try {
      await createNewFolder(parentDir, name.trim());
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Create a folder under the selected directory in the open workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="new-folder-name">Folder name</Label>
            <Input
              id="new-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              autoFocus
            />
          </div>
          {dirOptions.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="new-folder-parent">Parent directory</Label>
              <select
                id="new-folder-parent"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={creating}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={creating || !name.trim() || !parentDir}
            onClick={() => void create()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
