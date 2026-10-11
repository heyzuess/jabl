/**
 * Hover / Documentation formatting for OpenEdge ABL.
 * Syntax content is sourced from the Progress ABL Reference catalog.
 */

import {
  getBuiltinDocsUrl,
  getBuiltinType,
  isBuiltinPath,
} from "./builtin/builtin-types";
import {
  ABL_REFERENCE_INDEX_PAGE,
  ablReferenceUrl,
  categoryLabel,
  getAblDocEntry,
  type AblDocEntry,
} from "./reference";
import type { AblSymbol } from "./symbols";

export const OPEN_DOC_COMMAND = "jabl.openAblDocumentation";

export function formatDocEntryMarkdown(
  entry: AblDocEntry,
  opts?: { includeExpandLink?: boolean; compact?: boolean }
): string {
  const includeExpand = opts?.includeExpandLink !== false;
  const compact = !!opts?.compact;
  const cat = categoryLabel(entry.category);
  const parts: string[] = [
    `**${entry.name}** — ${cat}`,
    "",
    entry.summary,
    "",
    "**Syntax**",
    "```abl",
    entry.syntax.trim(),
    "```",
  ];

  if (entry.example && !compact) {
    parts.push("", "**Example**", "```abl", entry.example.trim(), "```");
  } else if (entry.example && compact) {
    parts.push("", "**Example**", "```abl", entry.example.trim(), "```");
  }

  // Only link verified Progress pages (never invent slugs that 404)
  if (entry.docsPage) {
    parts.push(
      "",
      `[Progress ABL Reference](${ablReferenceUrl(entry.docsPage)})`
    );
  } else {
    parts.push(
      "",
      `[Browse ABL Syntax Reference](${ablReferenceUrl(ABL_REFERENCE_INDEX_PAGE)})`
    );
  }

  if (includeExpand) {
    const arg = encodeURIComponent(JSON.stringify([entry.name]));
    parts.push(
      "",
      `[Open in Documentation ▸](command:${OPEN_DOC_COMMAND}?${arg})`
    );
  }

  return parts.join("\n");
}

export function getLanguageDoc(name: string): {
  kind: "builtin" | "keyword";
  entry: AblDocEntry;
  markdown: string;
} | null {
  const entry = getAblDocEntry(name);
  if (!entry) return null;
  const kind = entry.category === "function" ? "builtin" : "keyword";
  return {
    kind,
    entry,
    markdown: formatDocEntryMarkdown(entry, { includeExpandLink: true }),
  };
}

export function formatSymbolHover(opts: {
  name: string;
  kind: string;
  detail: string;
  signature: string;
  excerpt: string;
  path?: string;
}): string {
  const builtin = isBuiltinPath(opts.path);
  const docsUrl =
    (opts.path && getBuiltinDocsUrl(opts.path)) ||
    getBuiltinDocsUrl(opts.name);
  const where = opts.path
    ? builtin
      ? `\n\n_Built-in type_`
      : `\n\n_Defined in_ \`${opts.path}\``
    : "";
  const code = opts.excerpt.trim() || opts.signature;
  const arg = encodeURIComponent(
    JSON.stringify([
      {
        name: opts.name,
        kind: opts.kind,
        detail: opts.detail,
        signature: opts.signature,
        excerpt: opts.excerpt,
        path: opts.path ?? null,
      },
    ])
  );
  const external = docsUrl
    ? `\n\n[OpenEdge / Progress Reference](${docsUrl})`
    : "";
  return (
    `**${opts.name}** — ${opts.kind}\n\n` +
    `${opts.detail}\n\n` +
    "**Syntax / definition**\n" +
    "```abl\n" +
    code +
    "\n```" +
    where +
    external +
    `\n\n[Open in Documentation ▸](command:${OPEN_DOC_COMMAND}?${arg})`
  );
}

export function formatSymbolAsDocEntry(symbol: AblSymbol): AblDocEntry {
  const fqn = symbol.path?.startsWith("builtin:")
    ? symbol.path.slice("builtin:".length)
    : symbol.name;
  const catalog = getBuiltinType(fqn);
  return {
    name: catalog?.name ?? symbol.name,
    category: "definition",
    summary:
      catalog?.summary ??
      `${symbol.detail}${symbol.path ? ` — ${symbol.path}` : ""}`,
    syntax: catalog?.signature || symbol.signature || symbol.excerpt,
    example: catalog?.example,
  };
}

/** Absolute docs URL for a symbol (builtin Progress/OpenEdge pages). */
export function symbolDocsUrl(symbol: AblSymbol): string | null {
  if (symbol.path) {
    const u = getBuiltinDocsUrl(symbol.path);
    if (u) return u;
  }
  return getBuiltinDocsUrl(symbol.name);
}

export function getKeywordDoc(name: string): string | null {
  const entry = getAblDocEntry(name);
  return entry ? entry.summary : null;
}

export function getBuiltinDoc(name: string): string | null {
  const entry = getAblDocEntry(name);
  if (!entry || entry.category !== "function") return null;
  return entry.summary;
}
