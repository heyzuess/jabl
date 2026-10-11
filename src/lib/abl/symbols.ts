/** Lightweight ABL symbol extraction for completions and hover. */

export type AblSymbolKind =
  | "function"
  | "procedure"
  | "class"
  | "interface"
  | "enum"
  | "method"
  | "property"
  | "constructor"
  | "destructor"
  | "define"
  | "variable"
  | "type";

export type AblSymbol = {
  name: string;
  kind: AblSymbolKind;
  detail: string;
  signature: string;
  /** Full declaration excerpt for hover */
  excerpt: string;
  path?: string;
  /** 1-based inclusive line range */
  startLine: number;
  endLine: number;
  container?: string;
  access?: string;
  insertText?: string;
};

export type AblIncludeRef = {
  path: string;
  line: number;
  column: number;
};

export type AblUsing = {
  name: string;
  wildcard: boolean;
  packagePrefix: string;
  line: number;
};

export type AblTypedVariable = {
  name: string;
  typeName: string;
  line: number;
};

const END_KIND: Record<string, string[]> = {
  function: ["FUNCTION"],
  procedure: ["PROCEDURE"],
  method: ["METHOD"],
  class: ["CLASS"],
  interface: ["INTERFACE"],
  enum: ["ENUM"],
  constructor: ["CONSTRUCTOR"],
  destructor: ["DESTRUCTOR"],
};

function stripCommentsAndStrings(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") break;
    if (line[i] === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end < 0) break;
      i = end + 2;
      continue;
    }
    if (line[i] === '"') {
      out += '"';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          out += '"';
          i++;
          if (line[i] === '"') {
            out += '"';
            i++;
            continue;
          }
          break;
        }
        out += " ";
        i++;
      }
      continue;
    }
    if (line[i] === "'") {
      out += "'";
      i++;
      while (i < line.length && line[i] !== "'") {
        out += " ";
        i++;
      }
      if (i < line.length) {
        out += "'";
        i++;
      }
      continue;
    }
    out += line[i];
    i++;
  }
  return out;
}

function linesOf(source: string): string[] {
  return source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function findBlockEnd(
  lines: string[],
  startIdx: number,
  kind: AblSymbolKind
): number {
  const endTokens = END_KIND[kind];
  if (!endTokens) return startIdx;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]).trim();
    const upper = cleaned.toUpperCase();
    if (!upper.startsWith("END")) continue;
    const rest = upper.slice(3).replace(/^\s+/, "").replace(/\.$/, "").trim();
    if (!rest || endTokens.includes(rest)) return i;
  }
  // Fallback: next blank-ish end or a few lines of header
  return Math.min(startIdx + 12, lines.length - 1);
}

function excerptFor(
  lines: string[],
  start: number,
  end: number,
  maxLines = 40
): string {
  const slice = lines.slice(start, end + 1);
  if (slice.length <= maxLines) return slice.join("\n");
  return [...slice.slice(0, maxLines - 1), "  /* … */"].join("\n");
}

function shortName(qualified: string): string {
  const parts = qualified.split(".");
  return parts[parts.length - 1] || qualified;
}

/**
 * Extract include refs like `{utils.i}`, `{path/file.i}`, `{file.i &arg=1}`.
 */
export function extractIncludes(source: string): AblIncludeRef[] {
  const lines = linesOf(source);
  const out: AblIncludeRef[] = [];
  const re = /\{([^}&]+?)(?:\s|&[^}]*)?\}/g;

  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]);
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(cleaned)) !== null) {
      const raw = m[1].trim();
      // Skip preprocessor names like {&NAME}
      if (raw.startsWith("&")) continue;
      const path = raw.split(/\s+/)[0]?.replace(/\\/g, "/") ?? "";
      if (!path || path.includes("=")) continue;
      out.push({ path, line: i + 1, column: (m.index ?? 0) + 1 });
    }
  }
  return out;
}

/** Extract USING pkg.Type or USING pkg.*. */
export function extractUsings(source: string): AblUsing[] {
  const lines = linesOf(source);
  const out: AblUsing[] = [];
  const re = /^\s*USING\s+([\w.\-*]+)\s*\.?/i;

  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]);
    const m = cleaned.match(re);
    if (!m) continue;
    const name = m[1];
    const wildcard = name.endsWith(".*");
    const packagePrefix = wildcard ? name.slice(0, -2) : name.includes(".")
      ? name.slice(0, name.lastIndexOf("."))
      : "";
    out.push({
      name,
      wildcard,
      packagePrefix,
      line: i + 1,
    });
  }
  return out;
}

export type AblTypeRef = {
  name: string;
  line: number;
  kind: "inherits" | "implements" | "new" | "as-class";
};

/** INHERITS / IMPLEMENTS / NEW Type( / AS CLASS Type references. */
export function extractTypeRefs(source: string): AblTypeRef[] {
  const lines = linesOf(source);
  const out: AblTypeRef[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]);
    if (!cleaned.trim()) continue;

    const inherits = cleaned.match(/\bINHERITS\s+([A-Za-z_][\w.]*)/i);
    if (inherits) {
      out.push({ name: inherits[1], line: i + 1, kind: "inherits" });
    }

    const implementsMatch = cleaned.match(
      /\bIMPLEMENTS\s+([A-Za-z_][\w.,\s]*)/i
    );
    if (implementsMatch) {
      for (const part of implementsMatch[1].split(",")) {
        const name = part.trim().replace(/\s+/g, "");
        if (name) out.push({ name, line: i + 1, kind: "implements" });
      }
    }

    const newRe = /\bNEW\s+([A-Za-z_][\w.]*)\s*\(/gi;
    let nm: RegExpExecArray | null;
    while ((nm = newRe.exec(cleaned)) !== null) {
      out.push({ name: nm[1], line: i + 1, kind: "new" });
    }

    const asClass = cleaned.match(
      /\bAS\s+CLASS\s+([A-Za-z_][\w.]*)/i
    );
    if (asClass) {
      out.push({ name: asClass[1], line: i + 1, kind: "as-class" });
    }
  }
  return out;
}

export type AblRunTarget = {
  path: string;
  line: number;
};

/**
 * External RUN targets with a file extension (.p / .w / .r).
 * Skips internal procedure names like `RUN LoadCustomers.`.
 */
export function extractRunTargets(source: string): AblRunTarget[] {
  const lines = linesOf(source);
  const out: AblRunTarget[] = [];
  const re =
    /\bRUN\s+(?:"([^"]+\.(?:p|w|r))"|'([^']+\.(?:p|w|r))'|([A-Za-z0-9_./\\-]+\.(?:p|w|r)))/gi;

  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]);
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(cleaned)) !== null) {
      const path = (m[1] || m[2] || m[3] || "").replace(/\\/g, "/");
      if (path) out.push({ path, line: i + 1 });
    }
  }
  return out;
}

/** Typed DEFINE VARIABLE / PROPERTY … AS Type (non-primitive class types). */
export function extractTypedVariables(source: string): AblTypedVariable[] {
  const lines = linesOf(source);
  const out: AblTypedVariable[] = [];
  const primitives = new Set([
    "CHARACTER",
    "INTEGER",
    "INT64",
    "DECIMAL",
    "LOGICAL",
    "DATE",
    "DATETIME",
    "DATETIME-TZ",
    "HANDLE",
    "ROWID",
    "RECID",
    "RAW",
    "MEMPTR",
    "BLOB",
    "CLOB",
    "LONGCHAR",
    "COM-HANDLE",
    "VOID",
    "CLASS",
  ]);

  const re =
    /\bDEFINE\s+(?:(?:PUBLIC|PROTECTED|PRIVATE|PACKAGE-PRIVATE|STATIC|ABSTRACT|OVERRIDE|FINAL)\s+)*(?:VARIABLE|PROPERTY)\s+([A-Za-z_]\w*)\s+AS\s+(?:CLASS\s+)?([A-Za-z_][\w.]*)/i;

  for (let i = 0; i < lines.length; i++) {
    const cleaned = stripCommentsAndStrings(lines[i]);
    const m = cleaned.match(re);
    if (!m) continue;
    const typeName = m[2];
    if (primitives.has(typeName.toUpperCase())) continue;
    out.push({ name: m[1], typeName, line: i + 1 });
  }
  return out;
}

function pushSymbol(
  list: AblSymbol[],
  symbol: AblSymbol,
  path?: string
): void {
  list.push(path ? { ...symbol, path } : symbol);
}

/**
 * Parse ABL source for declarations useful to IntelliSense / hover.
 */
export function extractSymbols(source: string, path?: string): AblSymbol[] {
  const lines = linesOf(source);
  const symbols: AblSymbol[] = [];
  let currentType: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const cleaned = stripCommentsAndStrings(raw).trim();
    if (!cleaned) continue;
    const upper = cleaned.toUpperCase();

    // Preprocessor defines
    const defMatch = cleaned.match(
      /^&(GLOBAL-DEFINE|SCOPED-DEFINE)\s+([A-Za-z_][\w-]*)\s*(.*)$/i
    );
    if (defMatch) {
      pushSymbol(
        symbols,
        {
          name: defMatch[2],
          kind: "define",
          detail: `Preprocessor ${defMatch[1].toUpperCase()}`,
          signature: cleaned,
          excerpt: cleaned,
          startLine: i + 1,
          endLine: i + 1,
          insertText: defMatch[2],
        },
        path
      );
      continue;
    }

    // CLASS / INTERFACE / ENUM
    const typeMatch = cleaned.match(
      /^(?:ABSTRACT\s+|SERIALIZABLE\s+|FINAL\s+)*(CLASS|INTERFACE|ENUM)\s+([A-Za-z_][\w.]*)/i
    );
    if (typeMatch) {
      const kind = typeMatch[1].toLowerCase() as "class" | "interface" | "enum";
      const name = typeMatch[2];
      currentType = name;
      const end = findBlockEnd(lines, i, kind);
      pushSymbol(
        symbols,
        {
          name,
          kind,
          detail: `${kind[0].toUpperCase()}${kind.slice(1)} ${name}`,
          signature: cleaned.replace(/\s*:?\s*$/, ""),
          excerpt: excerptFor(lines, i, Math.min(i + 8, end)),
          startLine: i + 1,
          endLine: end + 1,
          insertText: shortName(name),
        },
        path
      );
      // Also index short name
      if (name.includes(".")) {
        pushSymbol(
          symbols,
          {
            name: shortName(name),
            kind,
            detail: `${kind[0].toUpperCase()}${kind.slice(1)} ${name}`,
            signature: cleaned.replace(/\s*:?\s*$/, ""),
            excerpt: excerptFor(lines, i, Math.min(i + 8, end)),
            startLine: i + 1,
            endLine: end + 1,
            container: name,
            insertText: shortName(name),
          },
          path
        );
      }
      continue;
    }

    // FUNCTION
    const fnMatch = cleaned.match(
      /^FUNCTION\s+([A-Za-z_]\w*)\s+RETURNS\s+(\S+)/i
    );
    if (fnMatch) {
      const end = findBlockEnd(lines, i, "function");
      pushSymbol(
        symbols,
        {
          name: fnMatch[1],
          kind: "function",
          detail: `Function → ${fnMatch[2]}`,
          signature: cleaned,
          excerpt: excerptFor(lines, i, end),
          startLine: i + 1,
          endLine: end + 1,
          insertText: fnMatch[1],
        },
        path
      );
      continue;
    }

    // PROCEDURE
    const procMatch = cleaned.match(/^PROCEDURE\s+([A-Za-z_]\w*)/i);
    if (procMatch) {
      const end = findBlockEnd(lines, i, "procedure");
      pushSymbol(
        symbols,
        {
          name: procMatch[1],
          kind: "procedure",
          detail: "Procedure",
          signature: cleaned.replace(/\s*:?\s*$/, ""),
          excerpt: excerptFor(lines, i, end),
          startLine: i + 1,
          endLine: end + 1,
          insertText: procMatch[1],
        },
        path
      );
      continue;
    }

    // METHOD (modifiers may appear in any order before return type)
    const methodMatch = cleaned.match(
      /^METHOD\s+((?:(?:PUBLIC|PROTECTED|PRIVATE|PACKAGE-PRIVATE|STATIC|ABSTRACT|OVERRIDE|FINAL)\s+)*)(\S+)\s+([A-Za-z_]\w*)\s*\(/i
    );
    if (methodMatch) {
      const modifiers = methodMatch[1].trim();
      const access =
        modifiers
          .split(/\s+/)
          .find((m) =>
            /^(PUBLIC|PROTECTED|PRIVATE|PACKAGE-PRIVATE)$/i.test(m)
          ) ?? undefined;
      const ret = methodMatch[2];
      const name = methodMatch[3];
      // Interface / abstract signatures often end on the same line with `).`
      const sameLineEnd = /\)\s*\.\s*$/.test(cleaned);
      const end = sameLineEnd ? i : findBlockEnd(lines, i, "method");
      pushSymbol(
        symbols,
        {
          name,
          kind: "method",
          detail: `Method → ${ret}`,
          signature: cleaned.replace(/\s*:?\s*$/, ""),
          excerpt: excerptFor(lines, i, end),
          startLine: i + 1,
          endLine: end + 1,
          container: currentType,
          access,
          insertText: name,
        },
        path
      );
      continue;
    }

    // CONSTRUCTOR / DESTRUCTOR
    const ctorMatch = cleaned.match(
      /^(CONSTRUCTOR|DESTRUCTOR)\s+(?:(PUBLIC|PROTECTED|PRIVATE)\s+)?([A-Za-z_]\w*)/i
    );
    if (ctorMatch) {
      const kind = ctorMatch[1].toLowerCase() as "constructor" | "destructor";
      const name = ctorMatch[3];
      const end = findBlockEnd(lines, i, kind);
      pushSymbol(
        symbols,
        {
          name,
          kind,
          detail: kind === "constructor" ? "Constructor" : "Destructor",
          signature: cleaned.replace(/\s*:?\s*$/, ""),
          excerpt: excerptFor(lines, i, end),
          startLine: i + 1,
          endLine: end + 1,
          container: currentType,
          access: ctorMatch[2],
          insertText: name,
        },
        path
      );
      continue;
    }

    // PROPERTY (may span lines for GET/SET)
    const propMatch = cleaned.match(
      /^DEFINE\s+(?:(PUBLIC|PROTECTED|PRIVATE|PACKAGE-PRIVATE)\s+)?(?:(STATIC|ABSTRACT|OVERRIDE|FINAL)\s+)*PROPERTY\s+([A-Za-z_]\w*)\s+AS\s+(\S+)/i
    );
    if (propMatch) {
      let end = i;
      for (let j = i; j < Math.min(i + 8, lines.length); j++) {
        const u = stripCommentsAndStrings(lines[j]).toUpperCase();
        if (/\bSET\s*\./.test(u) || /\bGET\s*\./.test(u)) end = j;
        if (j > i && /^\s*DEFINE\b/i.test(lines[j])) break;
        if (j > i && /^\s*METHOD\b/i.test(lines[j])) break;
        if (j > i && /^\s*CONSTRUCTOR\b/i.test(lines[j])) break;
      }
      pushSymbol(
        symbols,
        {
          name: propMatch[3],
          kind: "property",
          detail: `Property AS ${propMatch[4]}`,
          signature: cleaned,
          excerpt: excerptFor(lines, i, end),
          startLine: i + 1,
          endLine: end + 1,
          container: currentType,
          access: propMatch[1],
          insertText: propMatch[3],
        },
        path
      );
      continue;
    }

    // Reset container when leaving type
    if (
      currentType &&
      (upper.startsWith("END CLASS") ||
        upper.startsWith("END INTERFACE") ||
        upper.startsWith("END ENUM"))
    ) {
      currentType = undefined;
    }
  }

  return symbols;
}

export function kindCompletionKind(kind: AblSymbolKind): number {
  switch (kind) {
    case "function":
    case "method":
      return 1; // Function
    case "procedure":
      return 2; // Method (close enough)
    case "class":
    case "interface":
    case "enum":
    case "type":
      return 5; // Class
    case "property":
    case "variable":
      return 4; // Field
    case "constructor":
    case "destructor":
      return 3; // Constructor
    case "define":
      return 11; // Constant
    default:
      return 17; // Keyword
  }
}

export function memberKinds(): AblSymbolKind[] {
  return ["method", "property", "constructor", "destructor"];
}

export function typeKinds(): AblSymbolKind[] {
  return ["class", "interface", "enum", "type"];
}

export function callableKinds(): AblSymbolKind[] {
  return ["function", "procedure"];
}
