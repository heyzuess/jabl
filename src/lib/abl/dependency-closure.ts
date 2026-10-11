/** Gather workspace files needed to compile/run an ABL entry program. */

import {
  collectNodePaths,
  findNode,
  readAttachedFile,
} from "@/lib/workspace/fs-access";
import type { FileNode } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { isAblFile } from "./keywords";
import {
  extractIncludes,
  extractRunTargets,
  extractSymbols,
  extractTypeRefs,
  extractTypedVariables,
  extractUsings,
  typeKinds,
  type AblSymbol,
} from "./symbols";
import {
  resolveIncludePath,
  resolveTypeName,
  shortTypeName,
} from "./workspace-index";

export type DependencyClosure = {
  entry: string;
  files: Record<string, string>;
  missing: string[];
  propathRoots: string[];
};

function isBuiltinType(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith("progress.") ||
    lower.startsWith("openedge.") ||
    lower === "progress" ||
    lower === "openedge"
  );
}

function listAblPaths(
  root: FileNode | null,
  buffers: Record<string, string>
): string[] {
  const paths = root
    ? collectNodePaths(root).filter((p) => isAblFile(p) && !p.endsWith("/"))
    : [];
  for (const p of Object.keys(buffers)) {
    if (isAblFile(p) && !paths.includes(p)) paths.push(p);
  }
  return paths;
}

async function loadContent(
  path: string,
  root: FileNode | null,
  buffers: Record<string, string>
): Promise<string | null> {
  if (buffers[path] != null) return buffers[path];
  const node = findNode(root, path);
  if (!node || node.kind !== "file") return null;
  if (node.content != null) return node.content;
  try {
    return await readAttachedFile(node);
  } catch {
    return null;
  }
}

function gatherWorkspaceTypesFromCache(
  typeIndex: Map<string, AblSymbol>
): AblSymbol[] {
  return [...typeIndex.values()];
}

async function indexWorkspaceTypes(
  root: FileNode | null,
  buffers: Record<string, string>,
  ablPaths: string[]
): Promise<Map<string, AblSymbol>> {
  const map = new Map<string, AblSymbol>();
  const kinds = new Set(typeKinds());

  for (const path of ablPaths) {
    if (!path.toLowerCase().endsWith(".cls")) continue;
    const content = await loadContent(path, root, buffers);
    if (content == null) continue;
    for (const s of extractSymbols(content, path)) {
      if (!kinds.has(s.kind)) continue;
      map.set(s.name.toLowerCase(), s);
      map.set(shortTypeName(s.name).toLowerCase(), s);
    }
  }
  return map;
}

function resolveTypeToPath(
  typeName: string,
  usings: ReturnType<typeof extractUsings>,
  typeIndex: Map<string, AblSymbol>,
  ablPaths: string[]
): string | null {
  if (isBuiltinType(typeName)) return null;

  const workspaceTypes = gatherWorkspaceTypesFromCache(typeIndex);
  const resolved = resolveTypeName(typeName, usings, workspaceTypes);
  if (isBuiltinType(resolved)) return null;

  const hit =
    typeIndex.get(resolved.toLowerCase()) ||
    typeIndex.get(shortTypeName(resolved).toLowerCase()) ||
    typeIndex.get(typeName.toLowerCase());
  if (hit?.path && !hit.path.startsWith("builtin:")) return hit.path;

  const dotted = resolved.replace(/\./g, "/");
  const candidates = [
    `${dotted}.cls`,
    `${shortTypeName(resolved)}.cls`,
  ];
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const found = ablPaths.find(
      (p) =>
        p.replace(/\\/g, "/").toLowerCase() === lower ||
        p.replace(/\\/g, "/").toLowerCase().endsWith("/" + lower)
    );
    if (found) return found;
  }
  return null;
}

function resolveRunPath(
  ref: string,
  fromPath: string,
  ablPaths: string[]
): string | null {
  return resolveIncludePath(ref, fromPath, ablPaths);
}

function propathRootsFromFiles(files: Record<string, string>): string[] {
  const roots = new Set<string>();
  for (const path of Object.keys(files)) {
    const parts = path.replace(/\\/g, "/").split("/");
    if (parts.length > 1) roots.add(parts[0]);
  }
  return [...roots];
}

/**
 * Build a recursive dependency closure for compiling/running `entryPath`.
 * Prefers dirty editor buffers over disk contents.
 */
export async function buildDependencyClosure(
  entryPath: string
): Promise<DependencyClosure> {
  const { root, buffers } = useWorkspaceStore.getState();
  const ablPaths = listAblPaths(root, buffers);
  const typeIndex = await indexWorkspaceTypes(root, buffers, ablPaths);

  const files: Record<string, string> = {};
  const missing: string[] = [];
  const queue: string[] = [];
  const seen = new Set<string>();

  const enqueue = (path: string | null, label: string) => {
    if (!path) {
      if (!missing.includes(label)) missing.push(label);
      return;
    }
    if (seen.has(path)) return;
    seen.add(path);
    queue.push(path);
  };

  enqueue(entryPath, entryPath);

  while (queue.length) {
    const path = queue.shift()!;
    const content = await loadContent(path, root, buffers);
    if (content == null) {
      if (!missing.includes(path)) missing.push(path);
      continue;
    }
    files[path] = content;

    const usings = extractUsings(content);

    for (const ref of extractIncludes(content)) {
      const resolved = resolveIncludePath(ref.path, path, ablPaths);
      enqueue(resolved, ref.path);
    }

    for (const run of extractRunTargets(content)) {
      const resolved = resolveRunPath(run.path, path, ablPaths);
      enqueue(resolved, run.path);
    }

    const typeNames = new Set<string>();
    for (const t of extractTypeRefs(content)) typeNames.add(t.name);
    for (const v of extractTypedVariables(content)) typeNames.add(v.typeName);

    for (const name of typeNames) {
      if (isBuiltinType(name)) continue;
      const resolved = resolveTypeToPath(name, usings, typeIndex, ablPaths);
      enqueue(resolved, name);
    }
  }

  return {
    entry: entryPath,
    files,
    missing,
    propathRoots: propathRootsFromFiles(files),
  };
}
