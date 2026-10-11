import type { languages, editor, Position, IRange } from "monaco-editor";
import {
  ABL_BUILTIN_FUNCTIONS,
  ABL_KEYWORDS,
  ABL_SNIPPETS,
} from "./keywords";
import { kindCompletionKind, type AblSymbol } from "./symbols";
import {
  getMembersForOwner,
  getSymbolsForModel,
  listIncludeFiles,
  modelWorkspacePath,
  noteBufferChange,
} from "./workspace-index";

function wordRange(model: editor.ITextModel, position: Position): IRange {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function linePrefix(model: editor.ITextModel, position: Position): string {
  return model
    .getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    })
    .replace(/\t/g, " ");
}

type CompletionContext =
  | { kind: "member"; owner: string }
  | { kind: "new" }
  | { kind: "include" }
  | { kind: "default" };

function detectContext(prefix: string): CompletionContext {
  const trimmed = prefix.trimEnd();

  // Include path: `{utils` or `{ path`
  if (/\{[^}]*$/.test(trimmed) && !/\{\&[^}]*$/.test(trimmed)) {
    return { kind: "include" };
  }

  // Member access: THIS-OBJECT: or foo:
  const member = trimmed.match(
    /([A-Za-z_][\w\-]*|THIS-OBJECT|SUPER)\s*:\s*([A-Za-z_][\w\-]*)?$/i
  );
  if (member) {
    return { kind: "member", owner: member[1] };
  }

  // NEW Type
  if (/\bNEW\s+[A-Za-z_][\w.]*$/i.test(trimmed) || /\bNEW\s+$/i.test(trimmed)) {
    return { kind: "new" };
  }

  return { kind: "default" };
}

function symbolToCompletion(
  symbol: AblSymbol,
  range: IRange
): languages.CompletionItem {
  return {
    label: symbol.name,
    kind: kindCompletionKind(symbol.kind),
    insertText: symbol.insertText ?? symbol.name,
    range,
    detail: symbol.detail,
    documentation: symbol.signature,
  };
}

function dedupeByLabel(
  items: languages.CompletionItem[]
): languages.CompletionItem[] {
  const seen = new Set<string>();
  const out: languages.CompletionItem[] = [];
  for (const item of items) {
    const key =
      typeof item.label === "string"
        ? item.label.toLowerCase()
        : item.label.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function createAblCompletionProvider(): languages.CompletionItemProvider {
  const uniqueKeywords = Array.from(
    new Set(ABL_KEYWORDS.map((k) => k.toUpperCase()))
  );
  const uniqueBuiltins = Array.from(
    new Set(ABL_BUILTIN_FUNCTIONS.map((k) => k.toUpperCase()))
  );

  return {
    triggerCharacters: [".", " ", "-", ":", "{"],
    async provideCompletionItems(model, position) {
      const range = wordRange(model, position);
      const path = modelWorkspacePath(model);
      const source = model.getValue();
      if (path) noteBufferChange(path, source);

      const prefix = linePrefix(model, position);
      const ctxKind = detectContext(prefix);

      const keywordItems: languages.CompletionItem[] = uniqueKeywords.map(
        (kw) => ({
          label: kw,
          kind: 17,
          insertText: kw,
          range,
          detail: "ABL keyword",
        })
      );

      const builtinItems: languages.CompletionItem[] = uniqueBuiltins.map(
        (fn) => ({
          label: fn,
          kind: 1,
          insertText: fn,
          range,
          detail: "Built-in function",
        })
      );

      const snippetItems: languages.CompletionItem[] = ABL_SNIPPETS.map(
        (s) => ({
          label: s.label,
          kind: 27,
          insertText: s.insertText,
          insertTextRules: 4,
          range,
          detail: s.detail,
          documentation: s.detail,
        })
      );

      try {
        if (ctxKind.kind === "include") {
          const includes = await listIncludeFiles();
          const brace = prefix.match(/\{([^}]*)$/);
          const typed = brace?.[1] ?? "";
          const items: languages.CompletionItem[] = includes.map((p) => {
            const base = p.split("/").pop() || p;
            // Prefer basename insert; keep full path as detail
            const insert =
              typed.includes("/") || typed.includes("\\") ? p : base;
            return {
              label: base,
              kind: 16, // File
              insertText: insert,
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - typed.length,
                endColumn: position.column,
              },
              detail: p,
              documentation: `Include ${p}`,
            };
          });
          return { suggestions: dedupeByLabel(items) };
        }

        const ctx = await getSymbolsForModel(path, source);

        if (ctxKind.kind === "member") {
          const members = getMembersForOwner(ctx, ctxKind.owner);
          // Also allow members declared in current buffer locals
          const localMembers = ctx.locals.filter((s) =>
            ["method", "property", "constructor", "destructor"].includes(
              s.kind
            )
          );
          const merged = [...members, ...localMembers];
          return {
            suggestions: dedupeByLabel(
              merged.map((s) => symbolToCompletion(s, range))
            ),
          };
        }

        if (ctxKind.kind === "new") {
          const typeItems = ctx.types.map((s) => symbolToCompletion(s, range));
          return { suggestions: dedupeByLabel(typeItems) };
        }

        const symbolItems: languages.CompletionItem[] = [
          ...ctx.locals.filter((s) =>
            ["function", "procedure", "define", "class", "interface", "enum"].includes(
              s.kind
            )
          ),
          ...ctx.fromIncludes,
          ...ctx.types,
        ].map((s) => symbolToCompletion(s, range));

        return {
          suggestions: dedupeByLabel([
            ...snippetItems,
            ...symbolItems,
            ...keywordItems,
            ...builtinItems,
          ]),
        };
      } catch {
        return {
          suggestions: [...snippetItems, ...keywordItems, ...builtinItems],
        };
      }
    },
  };
}
