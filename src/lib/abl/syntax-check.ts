/** Lightweight structural ABL syntax checker (not a full OpenEdge compiler). */

import { ABL_BUILTIN_FUNCTIONS, ABL_KEYWORDS } from "./keywords";

export type AblDiagnostic = {
  line: number; // 1-based
  column: number; // 1-based
  severity: "error" | "warning";
  message: string;
};

type BlockKind =
  | "DO"
  | "REPEAT"
  | "FOR"
  | "CASE"
  | "PROCEDURE"
  | "FUNCTION"
  | "METHOD"
  | "CLASS"
  | "CONSTRUCTOR"
  | "DESTRUCTOR"
  | "CATCH"
  | "FINALLY"
  | "INTERFACE"
  | "ENUM";

type OpenBlock = {
  kind: BlockKind;
  line: number;
  column: number;
};

const KEYWORD_SET = new Set(
  [...ABL_KEYWORDS, ...ABL_BUILTIN_FUNCTIONS].map((k) => k.toUpperCase())
);

const BLOCK_OPENERS: Record<string, BlockKind> = {
  DO: "DO",
  REPEAT: "REPEAT",
  FOR: "FOR",
  CASE: "CASE",
  PROCEDURE: "PROCEDURE",
  FUNCTION: "FUNCTION",
  METHOD: "METHOD",
  CLASS: "CLASS",
  CONSTRUCTOR: "CONSTRUCTOR",
  DESTRUCTOR: "DESTRUCTOR",
  CATCH: "CATCH",
  FINALLY: "FINALLY",
  INTERFACE: "INTERFACE",
  ENUM: "ENUM",
};

/** Words that commonly precede identifiers (skip unknown-keyword warnings). */
const IDENT_CONTEXT = new Set([
  "DEFINE",
  "VARIABLE",
  "PARAMETER",
  "TEMP-TABLE",
  "BUFFER",
  "PROPERTY",
  "PROCEDURE",
  "FUNCTION",
  "METHOD",
  "CLASS",
  "INTERFACE",
  "RUN",
  "USING",
  "AS",
  "LIKE",
  "TO",
  "FROM",
  "IN",
  "OF",
  "WHERE",
  "BY",
  "AND",
  "OR",
  "EQ",
  "NE",
  "GT",
  "LT",
  "GE",
  "LE",
  "ASSIGN",
  "CREATE",
  "DELETE",
  "FIND",
  "FOR",
  "EACH",
  "FIRST",
  "LAST",
  "INPUT",
  "OUTPUT",
  "INPUT-OUTPUT",
  "RETURN",
  "MESSAGE",
  "DISPLAY",
  "UPDATE",
  "ENABLE",
  "DISABLE",
  "IF",
  "THEN",
  "ELSE",
  "ELSEIF",
  "WHEN",
  "OTHERWISE",
  "ON",
  "WITH",
  "FRAME",
  "STREAM",
  "QUERY",
  "DATASET",
  "INITIAL",
  "FORMAT",
  "LABEL",
  "VIEW-AS",
  "NO-UNDO",
  "PUBLIC",
  "PROTECTED",
  "PRIVATE",
  "PACKAGE-PRIVATE",
  "STATIC",
  "ABSTRACT",
  "OVERRIDE",
  "FINAL",
  "INHERITS",
  "IMPLEMENTS",
  "ENUM",
  "EVENT",
  "SERIALIZABLE",
  "CAST",
  "NEW",
  "THIS-OBJECT",
  "SUPER",
  "SUBSTITUTE",
  "AVAILABLE",
  "CAN-FIND",
  "LOOKUP",
  "ENTRY",
  "INDEX",
  "LENGTH",
  "TRIM",
  "STRING",
  "INTEGER",
  "INT64",
  "DECIMAL",
  "LOGICAL",
  "CHARACTER",
  "DATE",
  "HANDLE",
  "VOID",
  "PROGRESS",
  "LANG",
  "GET",
  "SET",
  "END",
  "GLOBAL-DEFINE",
  "SCOPED-DEFINE",
  "UNDEFINE",
]);

export function checkAblSyntax(source: string): AblDiagnostic[] {
  const diagnostics: AblDiagnostic[] = [];
  const lines = source.split(/\r?\n/);
  const stack: OpenBlock[] = [];
  let inBlockComment = false;
  let sawIf = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i];
    let colBase = 1;

    // Strip / continue block comments
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end < 0) continue;
      line = line.slice(end + 2);
      colBase += end + 2;
      inBlockComment = false;
    }

    const stripped = stripLineLiteralsAndComments(
      line,
      lineNo,
      colBase,
      diagnostics,
      (stillOpen) => {
        inBlockComment = stillOpen;
      }
    );

    if (stripped == null) continue;

    const code = stripped.text;
    if (!code.trim()) continue;
    // Skip preprocessor directives (&GLOBAL-DEFINE, &IF, …)
    if (code.trimStart().startsWith("&")) continue;

    const tokens = tokenizeCode(code);
    if (!tokens.length) continue;

    // Track IF for ELSE validation
    for (const t of tokens) {
      const upper = t.value.toUpperCase();
      if (upper === "IF" || upper === "ELSEIF") sawIf = true;
      if (upper === "ELSE") {
        if (!sawIf) {
          diagnostics.push({
            line: lineNo,
            column: colBase + t.col,
            severity: "error",
            message: "ELSE without matching IF",
          });
        }
      }
    }

    // Block openers / END
    for (let ti = 0; ti < tokens.length; ti++) {
      const t = tokens[ti];
      const upper = t.value.toUpperCase();

      if (upper === "END") {
        const next = tokens[ti + 1];
        const endKind = next
          ? (BLOCK_OPENERS[next.value.toUpperCase()] as BlockKind | undefined)
          : undefined;

        if (!stack.length) {
          diagnostics.push({
            line: lineNo,
            column: colBase + t.col,
            severity: "error",
            message: "Unexpected END — no open block",
          });
          if (endKind) ti++;
          continue;
        }

        const top = stack[stack.length - 1];
        if (endKind) {
          if (top.kind !== endKind) {
            diagnostics.push({
              line: lineNo,
              column: colBase + t.col,
              severity: "error",
              message: `END ${endKind} does not match open ${top.kind} (line ${top.line})`,
            });
          } else {
            stack.pop();
          }
          ti++;
        } else {
          // Bare END closes innermost DO/REPEAT/FOR/CASE-like block
          stack.pop();
        }
        continue;
      }

      const openKind = BLOCK_OPENERS[upper];
      if (!openKind) continue;

      // DEFINE ENUM … members — not an ENUM type block
      if (
        openKind === "ENUM" &&
        ti > 0 &&
        tokens[ti - 1].value.toUpperCase() === "DEFINE"
      ) {
        continue;
      }

      // Interface / abstract method signatures end with ")."; they have no END METHOD
      if (openKind === "METHOD" && isMethodSignatureOnly(tokens, ti, code)) {
        continue;
      }

      stack.push({
        kind: openKind,
        line: lineNo,
        column: colBase + t.col,
      });
    }

    // Conservative unknown-keyword warnings on leading statement word
    const first = tokens[0];
    if (first && /^[A-Za-z][A-Za-z0-9_-]*$/.test(first.value)) {
      const upper = first.value.toUpperCase();
      if (
        !KEYWORD_SET.has(upper) &&
        !IDENT_CONTEXT.has(upper) &&
        upper.includes("-") // only warn on hyphenated lookalikes that aren't known
      ) {
        diagnostics.push({
          line: lineNo,
          column: colBase + first.col,
          severity: "warning",
          message: `Unrecognized keyword '${first.value}'`,
        });
      }
    }
  }

  if (inBlockComment) {
    diagnostics.push({
      line: lines.length || 1,
      column: 1,
      severity: "error",
      message: "Unclosed block comment (/* … */)",
    });
  }

  for (const open of stack) {
    diagnostics.push({
      line: open.line,
      column: open.column,
      severity: "error",
      message: `Unclosed ${open.kind} block — missing END`,
    });
  }

  // Sort by line/column
  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  return diagnostics;
}

export function formatDiagnostics(
  path: string,
  diags: AblDiagnostic[]
): string[] {
  const lines: string[] = [];
  for (const d of diags) {
    lines.push(
      `${path}:${d.line}:${d.column}: ${d.severity}: ${d.message}`
    );
  }
  const errors = diags.filter((d) => d.severity === "error").length;
  const warnings = diags.filter((d) => d.severity === "warning").length;
  if (!diags.length) {
    lines.push(`${path}: OK — no issues found`);
  } else {
    lines.push(`${errors} error(s), ${warnings} warning(s)`);
  }
  return lines;
}

export function diagnosticsToMarkers(diags: AblDiagnostic[]): {
  severity: "Error" | "Warning";
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  source: string;
}[] {
  return diags.map((d) => ({
    severity: d.severity === "error" ? "Error" : "Warning",
    startLineNumber: d.line,
    startColumn: d.column,
    endLineNumber: d.line,
    endColumn: d.column + 1,
    message: d.message,
    source: "abl-syntax",
  }));
}

type StripResult = { text: string };

function stripLineLiteralsAndComments(
  line: string,
  lineNo: number,
  colBase: number,
  diagnostics: AblDiagnostic[],
  setBlockComment: (open: boolean) => void
): StripResult | null {
  let out = "";
  let i = 0;
  let inString: '"' | "'" | null = null;

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    if (inString) {
      if (ch === inString) {
        // ABL doubles quotes to escape
        if (next === inString) {
          out += "  ";
          i += 2;
          continue;
        }
        inString = null;
        out += " ";
        i++;
        continue;
      }
      out += " ";
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      out += " ";
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      // line comment — rest ignored
      break;
    }

    if (ch === "/" && next === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end < 0) {
        setBlockComment(true);
        break;
      }
      out += " ".repeat(end + 2 - i);
      i = end + 2;
      continue;
    }

    out += ch;
    i++;
  }

  if (inString) {
    diagnostics.push({
      line: lineNo,
      column: colBase,
      severity: "error",
      message: `Unclosed string literal (${inString})`,
    });
  }

  return { text: out };
}

function tokenizeCode(code: string): { value: string; col: number }[] {
  const tokens: { value: string; col: number }[] = [];
  const re = /[A-Za-z_][A-Za-z0-9_-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) != null) {
    tokens.push({ value: m[0], col: m.index });
  }
  return tokens;
}

/**
 * True for method prototypes that are not followed by a body / END METHOD:
 * - ABSTRACT methods
 * - Interface-style signatures ending with `).` on the header line
 */
function isMethodSignatureOnly(
  tokens: { value: string; col: number }[],
  methodIndex: number,
  code: string
): boolean {
  for (let i = methodIndex; i < tokens.length; i++) {
    if (tokens[i].value.toUpperCase() === "ABSTRACT") return true;
  }
  const fromMethod = code.slice(tokens[methodIndex]?.col ?? 0);
  return /\)\s*\.\s*$/.test(fromMethod.trimEnd());
}
