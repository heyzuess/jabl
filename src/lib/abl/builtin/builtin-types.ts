/**
 * Built-in Progress.* / OpenEdge.* type catalog for completions, hover, and docs.
 */

import type { AblSymbol, AblSymbolKind } from "../symbols";
import type {
  BuiltinCatalogFile,
  BuiltinMember,
  BuiltinType,
  BuiltinTypeKind,
} from "./types";
import progressCatalog from "./progress-types.json";
import openedgeCoreCatalog from "./openedge-core-types.json";
import openedgeLoggingCatalog from "./openedge-logging-types.json";
import openedgeNetCatalog from "./openedge-net-types.json";
import openedgeWebCatalog from "./openedge-web-types.json";

export type { BuiltinMember, BuiltinType, BuiltinCatalogFile } from "./types";

function shortName(qualified: string): string {
  const parts = qualified.split(".");
  return parts[parts.length - 1] || qualified;
}

function mapTypeKind(kind: BuiltinTypeKind): AblSymbolKind {
  if (kind === "interface") return "interface";
  if (kind === "enum") return "enum";
  if (kind === "type") return "type";
  return "class";
}

function mapMemberKind(kind: BuiltinMember["kind"]): AblSymbolKind {
  if (kind === "property") return "property";
  if (kind === "constructor") return "constructor";
  if (kind === "destructor") return "destructor";
  if (kind === "event") return "method";
  if (kind === "enum") return "property";
  return "method";
}

function typeToSymbols(t: BuiltinType): {
  typeSymbols: AblSymbol[];
  members: AblSymbol[];
} {
  const path = `builtin:${t.name}`;
  const kind = mapTypeKind(t.kind);
  const detail = t.summary;
  const signature = t.signature || `${t.kind.toUpperCase()} ${t.name}`;
  const excerpt = signature;

  const fqn: AblSymbol = {
    name: t.name,
    kind,
    detail,
    signature,
    excerpt,
    path,
    startLine: 1,
    endLine: 1,
    insertText: t.name,
  };

  const short: AblSymbol = {
    ...fqn,
    name: shortName(t.name),
    insertText: shortName(t.name),
  };

  const members: AblSymbol[] = (t.members ?? []).map((m) => ({
    name: m.name,
    kind: mapMemberKind(m.kind),
    detail: m.summary ? `${m.detail} — ${m.summary}` : m.detail,
    signature: m.signature,
    excerpt: m.signature,
    path,
    startLine: 1,
    endLine: 1,
    container: t.name,
    access: m.access ?? "PUBLIC",
    insertText: m.name,
  }));

  // Avoid duplicate when FQN has no dots
  const typeSymbols =
    short.name.toLowerCase() === fqn.name.toLowerCase() ? [fqn] : [fqn, short];

  return { typeSymbols, members };
}

const catalogs: BuiltinCatalogFile[] = [
  progressCatalog as BuiltinCatalogFile,
  openedgeCoreCatalog as BuiltinCatalogFile,
  openedgeLoggingCatalog as BuiltinCatalogFile,
  openedgeNetCatalog as BuiltinCatalogFile,
  openedgeWebCatalog as BuiltinCatalogFile,
];

const allTypes: BuiltinType[] = catalogs.flatMap((c) => c.types ?? []);

const docsUrlByFqn = new Map<string, string>();
const typeByFqn = new Map<string, BuiltinType>();
const typeByShort = new Map<string, BuiltinType[]>();
const symbolsByFqn = new Map<string, AblSymbol>();
const membersByTypeKey = new Map<string, AblSymbol[]>();
const allTypeSymbols: AblSymbol[] = [];

for (const t of allTypes) {
  typeByFqn.set(t.name.toLowerCase(), t);
  docsUrlByFqn.set(t.name.toLowerCase(), t.docsUrl);
  const sn = shortName(t.name).toLowerCase();
  const bucket = typeByShort.get(sn) ?? [];
  bucket.push(t);
  typeByShort.set(sn, bucket);

  const { typeSymbols, members } = typeToSymbols(t);
  for (const s of typeSymbols) {
    allTypeSymbols.push(s);
    if (s.name.includes(".")) {
      symbolsByFqn.set(s.name.toLowerCase(), s);
    }
  }
  const keys = new Set([t.name.toLowerCase(), sn]);
  for (const key of keys) {
    const existing = membersByTypeKey.get(key) ?? [];
    membersByTypeKey.set(key, [...existing, ...members]);
  }
}

/** All built-in type symbols (FQN + short-name entries). */
export function getBuiltinTypeSymbols(): AblSymbol[] {
  return allTypeSymbols;
}

/** Public members for a type FQN or short name. */
export function getBuiltinMembers(typeName: string): AblSymbol[] {
  return membersByTypeKey.get(typeName.toLowerCase()) ?? [];
}

/** Raw catalog entry by FQN. */
export function getBuiltinType(fqn: string): BuiltinType | undefined {
  return typeByFqn.get(fqn.toLowerCase());
}

/** Resolve short or FQN name, optionally preferring USING matches. */
export function resolveBuiltinTypeName(
  name: string,
  usings: { name: string; wildcard: boolean }[] = []
): BuiltinType | undefined {
  const lower = name.toLowerCase();
  const exact = typeByFqn.get(lower);
  if (exact) return exact;

  const candidates = typeByShort.get(lower) ?? [];
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const matched = candidates.filter((t) =>
    usings.some((u) => {
      if (u.wildcard) {
        const prefix = u.name.endsWith(".*") ? u.name.slice(0, -2) : u.name;
        return (
          t.name === prefix ||
          t.name.toLowerCase().startsWith(prefix.toLowerCase() + ".")
        );
      }
      return (
        t.name.toLowerCase() === u.name.toLowerCase() ||
        shortName(t.name).toLowerCase() === shortName(u.name).toLowerCase()
      );
    })
  );
  if (matched.length === 1) return matched[0];
  // Prefer Progress.Lang / OpenEdge.Core when ambiguous
  const preferred =
    matched.find((t) => t.name.startsWith("Progress.Lang.")) ||
    matched.find((t) => t.name.startsWith("OpenEdge.Core.")) ||
    candidates.find((t) => t.name.startsWith("Progress.Lang.")) ||
    candidates[0];
  return preferred;
}

export function getBuiltinDocsUrl(nameOrPath: string): string | null {
  if (nameOrPath.startsWith("builtin:")) {
    return docsUrlByFqn.get(nameOrPath.slice("builtin:".length).toLowerCase()) ?? null;
  }
  return docsUrlByFqn.get(nameOrPath.toLowerCase()) ?? null;
}

/** Search catalog types for Documentation pane. */
export function searchBuiltinTypes(query: string): BuiltinType[] {
  const q = query.trim().toLowerCase();
  if (!q) return allTypes.slice().sort((a, b) => a.name.localeCompare(b.name));
  return allTypes
    .filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        shortName(t.name).toLowerCase().includes(q)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listBuiltinTypes(): BuiltinType[] {
  return allTypes.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function builtinTypeToAblSymbol(t: BuiltinType): AblSymbol {
  return {
    name: t.name,
    kind: mapTypeKind(t.kind),
    detail: t.summary,
    signature: t.signature || `${t.kind.toUpperCase()} ${t.name}`,
    excerpt: t.signature || `${t.kind.toUpperCase()} ${t.name}`,
    path: `builtin:${t.name}`,
    startLine: 1,
    endLine: 1,
    insertText: t.name,
  };
}

export function isBuiltinPath(path: string | undefined | null): boolean {
  return !!path && path.startsWith("builtin:");
}
