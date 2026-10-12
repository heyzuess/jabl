import type { DiffTabView } from "@/lib/workspace/types";
import { languageIdForPath } from "@/lib/abl/register";

const PREFIX = "gitdiff:";

export function isGitDiffPath(path: string): boolean {
  return path.startsWith(PREFIX);
}

export function makeGitDiffPath(view: Omit<DiffTabView, "type">): string {
  const file = encodeURIComponent(view.filepath);
  if (view.mode === "commits") {
    return `${PREFIX}commits:${view.originalRef}..${view.modifiedRef}:${file}`;
  }
  return `${PREFIX}${view.mode}:${file}`;
}

export function parseGitDiffPath(path: string): DiffTabView | null {
  if (!isGitDiffPath(path)) return null;
  const rest = path.slice(PREFIX.length);
  if (rest.startsWith("working:")) {
    const filepath = decodeURIComponent(rest.slice("working:".length));
    return {
      type: "diff",
      mode: "working",
      filepath,
      workspacePath: "",
      originalRef: "HEAD",
      modifiedRef: "WORKDIR",
      originalLabel: "HEAD",
      modifiedLabel: "Working Tree",
    };
  }
  if (rest.startsWith("staged:")) {
    const filepath = decodeURIComponent(rest.slice("staged:".length));
    return {
      type: "diff",
      mode: "staged",
      filepath,
      workspacePath: "",
      originalRef: "HEAD",
      modifiedRef: "STAGE",
      originalLabel: "HEAD",
      modifiedLabel: "Staged",
    };
  }
  if (rest.startsWith("commits:")) {
    const body = rest.slice("commits:".length);
    const colon = body.lastIndexOf(":");
    if (colon < 0) return null;
    const range = body.slice(0, colon);
    const filepath = decodeURIComponent(body.slice(colon + 1));
    const dots = range.indexOf("..");
    if (dots < 0) return null;
    const originalRef = range.slice(0, dots);
    const modifiedRef = range.slice(dots + 2);
    return {
      type: "diff",
      mode: "commits",
      filepath,
      workspacePath: "",
      originalRef,
      modifiedRef,
      originalLabel: originalRef ? originalRef.slice(0, 7) : "(empty)",
      modifiedLabel: modifiedRef.slice(0, 7),
    };
  }
  return null;
}

export function diffTabTitle(view: DiffTabView): string {
  const base = view.filepath.split("/").pop() || view.filepath;
  if (view.mode === "working") return `${base} (Working Tree)`;
  if (view.mode === "staged") return `${base} (Staged)`;
  return `${base} (${view.modifiedLabel})`;
}

export function languageForDiffFilepath(filepath: string): string {
  return languageIdForPath(filepath);
}
