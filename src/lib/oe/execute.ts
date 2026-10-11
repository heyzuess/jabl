"use client";

import { languageIdForPath } from "@/lib/abl/register";
import { buildDependencyClosure } from "@/lib/abl/dependency-closure";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { compileOrRun } from "./client";
import { useOutputStore } from "./output-store";
import type { OeMode } from "./types";

function resolveEntryPath(explicit?: string | null): string | null {
  const state = useWorkspaceStore.getState();
  if (explicit) {
    const normalized = explicit.replace(/\\/g, "/");
    if (state.buffers[normalized] != null) return normalized;
    const hit = Object.keys(state.buffers).find(
      (p) => p === normalized || p.endsWith(`/${normalized}`) || p.endsWith(normalized)
    );
    if (hit) return hit;
    return normalized;
  }
  return state.activePath;
}

export async function executeAbl(
  mode: OeMode,
  pathArg?: string | null
): Promise<{ ok: boolean; message: string }> {
  const entry = resolveEntryPath(pathArg);
  if (!entry) {
    return { ok: false, message: "No ABL file selected" };
  }
  if (languageIdForPath(entry) !== "abl") {
    return { ok: false, message: `Not an ABL file: ${entry}` };
  }

  useLayoutStore.getState().revealOutput();

  const output = useOutputStore.getState();
  if (output.busy) {
    return { ok: false, message: "A compile/run is already in progress" };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const controller = new AbortController();
  output.setBusy(true, controller);
  output.appendEntry({
    id,
    timestamp: Date.now(),
    mode,
    entry,
    status: "running",
    stdout: "",
    stderr: "",
    compileMessages: [],
    missing: [],
  });

  useWorkspaceStore.getState().setStatus(
    `${mode === "run" ? "Running" : "Compiling"} ${entry}…`
  );

  try {
    const closure = await buildDependencyClosure(entry);
    useOutputStore.getState().updateEntry(id, { missing: closure.missing });

    if (!closure.files[entry]) {
      useOutputStore.getState().updateEntry(id, {
        status: "error",
        error: `Could not read entry file: ${entry}`,
      });
      useWorkspaceStore.getState().setStatus(`Failed: ${entry}`);
      return { ok: false, message: `Could not read entry file: ${entry}` };
    }

    const result = await compileOrRun(
      mode,
      {
        entry: closure.entry,
        files: closure.files,
        propath: closure.propathRoots,
      },
      { signal: controller.signal }
    );

    const status = result.ok ? "ok" : "error";
    useOutputStore.getState().updateEntry(id, {
      status,
      stdout: result.stdout,
      stderr: result.stderr,
      compileMessages: result.compileMessages ?? [],
      error: result.error,
    });

    const summary = result.ok
      ? `${mode === "run" ? "Run" : "Compile"} succeeded: ${entry}`
      : result.error ||
        `${mode === "run" ? "Run" : "Compile"} failed: ${entry}`;
    useWorkspaceStore.getState().setStatus(summary);
    return { ok: result.ok, message: summary };
  } catch (err) {
    const message = (err as Error).message || String(err);
    useOutputStore.getState().updateEntry(id, {
      status: "error",
      error: message,
    });
    useWorkspaceStore.getState().setStatus(message);
    return { ok: false, message };
  } finally {
    useOutputStore.getState().setBusy(false, null);
  }
}
