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

function wordAt(
  model: editor.ITextModel,
  position: Position
): { word: string; range: IRange } | null {
  const w = model.getWordAtPosition(position);
  if (!w) return null;
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

      try {
        const symbol = await resolveSymbolAt(path, source, at.word, owner);
        if (symbol) {
          // Prefer Progress language docs when the word is also a language keyword
          // only if it's not a project-defined name — project symbols win.
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

      const lang = getLanguageDoc(at.word);
      if (!lang) return null;

      return {
        range: at.range,
        contents: [trustedMarkdown(lang.markdown)],
      };
    },
  };
}
