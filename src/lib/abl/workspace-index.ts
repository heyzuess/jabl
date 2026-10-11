/** Workspace-aware ABL symbol index for completions and hover. */

import type { editor } from "monaco-editor";
import {
  collectNodePaths,
  findNode,
  readAttachedFile,
} from "@/lib/workspace/fs-access";
import type { FileNode } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { isAblFile } from "./keywords";
import {
  getBuiltinMembers,
  getBuiltinTypeSymbols,
  resolveBuiltinTypeName,
} from "./builtin/builtin-types";
import {
  extractIncludes,
  extractSymbols,
  extractTypedVariables,
  extractUsings,
  memberKinds,
  typeKinds,
  type AblSymbol,
  type AblSymbolKind,
} from "./symbols";

type CachedFile = {
  content: string;
  symbols: AblSymbol[];
};

const cache = new Map<string, CachedFile>();
let lastRootKey = "";

function rootFingerprint(root: FileNode | null): string {
  if (!root) return "";
  return collectNodePaths(root).join("|");
}

function invalidateIfRootChanged(root: FileNode | null): void {
  const key = rootFingerprint(root);
  if (key !== lastRootKey) {
    cache.clear();
    lastRootKey = key;
  }
}

export function invalidateAblIndex(path?: string): void {
  if (path) {
    cache.delete(path);
    return;
  }
  cache.clear();
  lastRootKey = "";
}

/** Map Monaco model URI to workspace path (`groupId:path` → `path`). */
export function modelWorkspacePath(model: editor.ITextModel): string | null {
  try {
    let p = model.uri.path || "";
    if (p.startsWith("/")) p = p.slice(1);
    if (!p || p === "/") return null;
    // EditorPane sets path as `${groupId}:${activeTab.path}`
    const colon = p.indexOf(":");
    if (colon > 0 && !p.slice(0, colon).includes("/")) {
      p = p.slice(colon + 1);
    }
    return p || null;
  } catch {
    return null;
  }
}

function listAblFilePaths(root: FileNode | null): string[] {
  if (!root) return [];
  return collectNodePaths(root).filter(
    (p) => isAblFile(p) && !p.endsWith("/")
  );
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function normalizeIncludePath(ref: string): string {
  return ref.replace(/\\/g, "/").replace(/^\.\//, "");
}

async function loadFileContent(
  path: string,
  root: FileNode | null,
  buffers: Record<string, string>
): Promise<string | null> {
  if (buffers[path] != null) return buffers[path];
  const cached = cache.get(path);
  if (cached) return cached.content;

  const node = findNode(root, path);
  if (!node || node.kind !== "file") return null;
  if (node.content != null) return node.content;
  try {
    return await readAttachedFile(node);
  } catch {
    return null;
  }
}

function ensureParsed(path: string, content: string): AblSymbol[] {
  const existing = cache.get(path);
  if (existing && existing.content === content) return existing.symbols;
  const symbols = extractSymbols(content, path);
  cache.set(path, { content, symbols });
  return symbols;
}

/** Resolve an include reference to a workspace path. */
export function resolveIncludePath(
  ref: string,
  fromPath: string,
  ablPaths: string[]
): string | null {
  const normalized = normalizeIncludePath(ref);
  const lower = normalized.toLowerCase();

  // Exact / suffix match
  const exact = ablPaths.find(
    (p) =>
      p.replace(/\\/g, "/").toLowerCase() === lower ||
      p.replace(/\\/g, "/").toLowerCase().endsWith("/" + lower) ||
      basename(p).toLowerCase() === lower
  );
  if (exact) return exact;

  // Relative to including file's directory
  const fromDir = fromPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  if (fromDir) {
    const candidate = `${fromDir}/${normalized}`.toLowerCase();
    const rel = ablPaths.find(
      (p) => p.replace(/\\/g, "/").toLowerCase() === candidate
    );
    if (rel) return rel;
  }

  // Basename only
  const base = basename(normalized).toLowerCase();
  return (
    ablPaths.find((p) => basename(p).toLowerCase() === base) ?? null
  );
}

export function shortTypeName(name: string): string {
  const parts = name.split(".");
  return parts[parts.length - 1] || name;
}

function usingMatchesType(usingName: string, wildcard: boolean, typeName: string): boolean {
  if (wildcard) {
    const prefix = usingName.endsWith(".*")
      ? usingName.slice(0, -2)
      : usingName;
    return (
      typeName === prefix ||
      typeName.startsWith(prefix + ".") ||
      shortTypeName(typeName).toLowerCase() === shortTypeName(prefix).toLowerCase()
    );
  }
  return (
    typeName.toLowerCase() === usingName.toLowerCase() ||
    shortTypeName(typeName).toLowerCase() === shortTypeName(usingName).toLowerCase()
  );
}

/** Resolve a type name via workspace types, builtins, and USING clauses. */
export function resolveTypeName(
  name: string,
  usings: { name: string; wildcard: boolean }[],
  workspaceTypes: AblSymbol[]
): string {
  const lower = name.toLowerCase();
  const exact = workspaceTypes.find((t) => t.name.toLowerCase() === lower);
  if (exact) return exact.name;

  const shortHits = workspaceTypes.filter(
    (t) => shortTypeName(t.name).toLowerCase() === lower
  );
  if (shortHits.length === 1) return shortHits[0].name;
  if (shortHits.length > 1) {
    const matched = shortHits.filter((t) =>
      usings.some((u) => usingMatchesType(u.name, u.wildcard, t.name))
    );
    if (matched.length === 1) return matched[0].name;
    if (matched.length > 1) return matched[0].name;
  }

  const builtin = resolveBuiltinTypeName(name, usings);
  if (builtin) return builtin.name;

  return name;
}

async function gatherWorkspaceTypes(
  root: FileNode | null,
  buffers: Record<string, string>,
  ablPaths: string[]
): Promise<AblSymbol[]> {
  const types: AblSymbol[] = [];
  const kinds = new Set<AblSymbolKind>(typeKinds());

  for (const path of ablPaths) {
    if (!path.toLowerCase().endsWith(".cls")) continue;
    const content = await loadFileContent(path, root, buffers);
    if (content == null) continue;
    const symbols = ensureParsed(path, content);
    for (const s of symbols) {
      if (kinds.has(s.kind)) types.push(s);
    }
  }
  return types;
}

export type ModelSymbolContext = {
  locals: AblSymbol[];
  fromIncludes: AblSymbol[];
  types: AblSymbol[];
  membersByType: Map<string, AblSymbol[]>;
  typedVars: ReturnType<typeof extractTypedVariables>;
  usings: ReturnType<typeof extractUsings>;
  includePaths: string[];
  currentTypeName?: string;
};

function indexMembers(types: AblSymbol[], allByPath: Map<string, AblSymbol[]>): Map<string, AblSymbol[]> {
  const map = new Map<string, AblSymbol[]>();
  const memberSet = new Set(memberKinds());

  for (const t of types) {
    const keys = new Set([t.name, shortTypeName(t.name)]);

    if (t.path?.startsWith("builtin:")) {
      // Only index once per FQN (skip short-name duplicate symbols)
      const fqn = t.path.slice("builtin:".length);
      if (t.name !== fqn) continue;
      const members = getBuiltinMembers(fqn);
      for (const key of keys) {
        const existing = map.get(key.toLowerCase()) ?? [];
        map.set(key.toLowerCase(), [...existing, ...members]);
      }
      continue;
    }

    if (!t.path) continue;
    const fileSymbols = allByPath.get(t.path) ?? [];
    const members = fileSymbols.filter(
      (s) =>
        memberSet.has(s.kind) &&
        (!s.container ||
          s.container.toLowerCase() === t.name.toLowerCase() ||
          shortTypeName(s.container).toLowerCase() ===
            shortTypeName(t.name).toLowerCase())
    );
    for (const key of keys) {
      const existing = map.get(key.toLowerCase()) ?? [];
      map.set(key.toLowerCase(), [...existing, ...members]);
    }
  }
  return map;
}

/**
 * Build symbol context for a model (current file + includes + types).
 */
export async function getSymbolsForModel(
  path: string | null,
  source: string
): Promise<ModelSymbolContext> {
  const { root, buffers } = useWorkspaceStore.getState();
  invalidateIfRootChanged(root);

  const ablPaths = listAblFilePaths(root);
  // Also consider open buffer paths not yet in tree
  for (const p of Object.keys(buffers)) {
    if (isAblFile(p) && !ablPaths.includes(p)) ablPaths.push(p);
  }

  const locals = extractSymbols(source, path ?? undefined);
  ensureParsed(path ?? "__current__", source);

  const includeRefs = extractIncludes(source);
  const includePaths: string[] = [];
  const fromIncludes: AblSymbol[] = [];

  for (const ref of includeRefs) {
    const resolved = path
      ? resolveIncludePath(ref.path, path, ablPaths)
      : resolveIncludePath(ref.path, "", ablPaths);
    if (!resolved) continue;
    includePaths.push(resolved);
    const content = await loadFileContent(resolved, root, buffers);
    if (content == null) continue;
    const symbols = ensureParsed(resolved, content);
    for (const s of symbols) {
      if (s.kind === "function" || s.kind === "procedure" || s.kind === "define") {
        fromIncludes.push(s);
      }
    }
  }

  const workspaceTypes = await gatherWorkspaceTypes(root, buffers, ablPaths);
  const builtinTypes = getBuiltinTypeSymbols();
  // Prefer workspace definitions over builtins when names collide
  const workspaceKeys = new Set(
    workspaceTypes.map((t) => t.name.toLowerCase())
  );
  const mergedBuiltins = builtinTypes.filter(
    (t) => !workspaceKeys.has(t.name.toLowerCase())
  );
  const allTypes = [...workspaceTypes, ...mergedBuiltins];
  const usings = extractUsings(source);
  const typedVars = extractTypedVariables(source);

  // Types visible: USING-matched first, then remaining (incl. FQN builtins)
  let types = allTypes;
  if (usings.length > 0) {
    const matched = allTypes.filter((t) =>
      usings.some((u) => usingMatchesType(u.name, u.wildcard, t.name))
    );
    const seen = new Set(matched.map((t) => t.name + "|" + (t.path ?? "")));
    types = [
      ...matched,
      ...allTypes.filter((t) => !seen.has(t.name + "|" + (t.path ?? ""))),
    ];
  }

  const allByPath = new Map<string, AblSymbol[]>();
  for (const p of ablPaths) {
    if (!p.toLowerCase().endsWith(".cls")) continue;
    const content = await loadFileContent(p, root, buffers);
    if (content == null) continue;
    allByPath.set(p, ensureParsed(p, content));
  }
  if (path?.toLowerCase().endsWith(".cls")) {
    allByPath.set(path, locals);
  }

  const membersByType = indexMembers(allTypes, allByPath);

  const currentType = locals.find(
    (s) => s.kind === "class" || s.kind === "interface" || s.kind === "enum"
  );

  return {
    locals,
    fromIncludes,
    types,
    membersByType,
    typedVars,
    usings,
    includePaths,
    currentTypeName: currentType?.name,
  };
}

/** List .i paths for include-path completions. */
export async function listIncludeFiles(): Promise<string[]> {
  const { root, buffers } = useWorkspaceStore.getState();
  invalidateIfRootChanged(root);
  const paths = listAblFilePaths(root);
  for (const p of Object.keys(buffers)) {
    if (p.toLowerCase().endsWith(".i") && !paths.includes(p)) paths.push(p);
  }
  return paths.filter((p) => p.toLowerCase().endsWith(".i"));
}

function findInList(
  symbols: AblSymbol[],
  word: string,
  kinds?: AblSymbolKind[]
): AblSymbol | undefined {
  const lower = word.toLowerCase();
  return symbols.find(
    (s) =>
      s.name.toLowerCase() === lower &&
      (!kinds || kinds.includes(s.kind))
  );
}

/**
 * Resolve the symbol under/near a word for hover.
 * `memberOwner` is the identifier before `:` when resolving members.
 */
export async function resolveSymbolAt(
  path: string | null,
  source: string,
  word: string,
  memberOwner?: string | null
): Promise<AblSymbol | null> {
  const ctx = await getSymbolsForModel(path, source);
  const lower = word.toLowerCase();

  if (memberOwner) {
    const ownerUpper = memberOwner.toUpperCase();
    let typeKey: string | undefined;
    if (ownerUpper === "THIS-OBJECT" || ownerUpper === "SUPER") {
      typeKey = ctx.currentTypeName;
    } else {
      const tv = ctx.typedVars.find(
        (v) => v.name.toLowerCase() === memberOwner.toLowerCase()
      );
      typeKey = tv
        ? resolveTypeName(tv.typeName, ctx.usings, ctx.types)
        : resolveTypeName(memberOwner, ctx.usings, ctx.types);
    }
    if (typeKey) {
      const members =
        ctx.membersByType.get(typeKey.toLowerCase()) ??
        ctx.membersByType.get(shortTypeName(typeKey).toLowerCase()) ??
        getBuiltinMembers(typeKey);
      const hit = members.find((m) => m.name.toLowerCase() === lower);
      if (hit) return hit;
    }
  }

  // Locals first (prefer non-duplicate short class names carefully)
  const localHit =
    findInList(ctx.locals, word) ||
    findInList(ctx.fromIncludes, word);
  if (localHit) return localHit;

  // Exact FQN / short name on workspace + builtin types
  const resolvedName = resolveTypeName(word, ctx.usings, ctx.types);
  const typeHit =
    findInList(ctx.types, resolvedName, typeKinds()) ||
    findInList(ctx.types, word, typeKinds());
  if (typeHit) return typeHit;

  const builtin = resolveBuiltinTypeName(word, ctx.usings);
  if (builtin) {
    const builtinHit = ctx.types.find(
      (t) =>
        t.path === `builtin:${builtin.name}` &&
        (t.name === builtin.name ||
          shortTypeName(t.name).toLowerCase() === word.toLowerCase())
    );
    if (builtinHit) return builtinHit;
  }

  // Members of current class by bare name
  if (ctx.currentTypeName) {
    const members =
      ctx.membersByType.get(ctx.currentTypeName.toLowerCase()) ?? [];
    const hit = members.find((m) => m.name.toLowerCase() === lower);
    if (hit) return hit;
  }

  return null;
}

export function getMembersForOwner(
  ctx: ModelSymbolContext,
  owner: string
): AblSymbol[] {
  const ownerUpper = owner.toUpperCase();
  let typeKey: string | undefined;
  if (ownerUpper === "THIS-OBJECT" || ownerUpper === "SUPER") {
    typeKey = ctx.currentTypeName;
  } else {
    const tv = ctx.typedVars.find(
      (v) => v.name.toLowerCase() === owner.toLowerCase()
    );
    typeKey = tv
      ? resolveTypeName(tv.typeName, ctx.usings, ctx.types)
      : resolveTypeName(owner, ctx.usings, ctx.types);
  }
  if (!typeKey) return [];
  return (
    ctx.membersByType.get(typeKey.toLowerCase()) ??
    ctx.membersByType.get(shortTypeName(typeKey).toLowerCase()) ??
    getBuiltinMembers(typeKey)
  );
}

/** Sync invalidate helper for buffer updates. */
export function noteBufferChange(path: string, content: string): void {
  ensureParsed(path, content);
}
