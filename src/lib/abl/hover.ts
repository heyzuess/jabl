import type {
  languages,
  editor,
  Position,
  IRange,
  IMarkdownString,
} from "monaco-editor";
import { formatSymbolHover, getLanguageDoc } from "./docs";
import {
  modelWorkspacePath,
  noteBufferChange,
  resolveSymbolAt,
} from "./workspace-index";

function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_\-]/.test(ch);
}

/**
 * Expand Monaco's single-segment word to a dotted type name
 * (e.g. cursor on Object → Progress.Lang.Object).
 */
function dottedWordAt(
  model: editor.ITextModel,
  position: Position
): { word: string; range: IRange } | null {
  const line = model.getLineContent(position.lineNumber);
  let start = position.column - 1;
  let end = position.column - 1;
  if (start < 0 || start >= line.length) {
    // Allow cursor at end of identifier
    if (start === line.length && start > 0 && isIdentChar(line[start - 1])) {
      start--;
      end = start + 1;
    } else {
      return null;
    }
  }

  if (!isIdentChar(line[start]) && line[start] !== ".") {
    if (start > 0 && isIdentChar(line[start - 1])) {
      start--;
      end = start + 1;
    } else {
      return null;
    }
  }

  while (start > 0) {
    const prev = line[start - 1];
    if (isIdentChar(prev) || prev === ".") start--;
    else break;
  }
  while (end < line.length && (isIdentChar(line[end]) || line[end] === ".")) {
    end++;
  }

  let word = line.slice(start, end);
  // Trim leading/trailing dots
  word = word.replace(/^\.+/, "").replace(/\.+$/, "");
  if (!word) return null;

  return {
    word,
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: start + 1,
      endColumn: end + 1,
    },
  };
}

function wordAt(
  model: editor.ITextModel,
  position: Position
): { word: string; range: IRange } | null {
  const dotted = dottedWordAt(model, position);
  if (dotted && dotted.word.includes(".")) return dotted;

  const w = model.getWordAtPosition(position);
  if (!w) return dotted;
  return {
    word: w.word,
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: w.startColumn,
      endColumn: w.endColumn,
    },
  };
}

/** Identifier before `:` on the same line, if the hover word is a member. */
function memberOwner(
  model: editor.ITextModel,
  position: Position,
  wordStartColumn: number
): string | null {
  const prefix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: wordStartColumn,
  });
  const m = prefix.match(
    /([A-Za-z_][\w\-]*|THIS-OBJECT|SUPER)\s*:\s*$/i
  );
  return m?.[1] ?? null;
}

function trustedMarkdown(value: string): IMarkdownString {
  return {
    value,
    isTrusted: true,
    supportThemeIcons: true,
  };
}

export function createAblHoverProvider(): languages.HoverProvider {
  return {
    async provideHover(model, position) {
      const at = wordAt(model, position);
      if (!at) return null;

      const path = modelWorkspacePath(model);
      const source = model.getValue();
      if (path) noteBufferChange(path, source);

      const owner = memberOwner(model, position, at.range.startColumn);
      // For member hover, resolve the bare member name (last segment)
      const resolveWord = owner
        ? at.word.includes(".")
          ? at.word.split(".").pop()!
          : at.word
        : at.word;

      try {
        const symbol = await resolveSymbolAt(
          path,
          source,
          resolveWord,
          owner
        );
        if (symbol) {
          const md = formatSymbolHover({
            name: symbol.name,
            kind: symbol.kind,
            detail: symbol.detail,
            signature: symbol.signature,
            excerpt: symbol.excerpt,
            path: symbol.path,
          });
          return {
            range: at.range,
            contents: [trustedMarkdown(md)],
          };
        }
      } catch {
        // fall through to language docs
      }

      // Keyword docs use the bare segment under the cursor
      const bare =
        model.getWordAtPosition(position)?.word ??
        resolveWord.split(".").pop() ??
        resolveWord;
      const lang = getLanguageDoc(bare);
      if (!lang) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: model.getWordAtPosition(position)?.startColumn ?? at.range.startColumn,
          endColumn: model.getWordAtPosition(position)?.endColumn ?? at.range.endColumn,
        },
        contents: [trustedMarkdown(lang.markdown)],
      };
    },
  };
}
