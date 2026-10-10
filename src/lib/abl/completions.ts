import type { languages, editor, Position, IRange } from "monaco-editor";
import {
  ABL_BUILTIN_FUNCTIONS,
  ABL_KEYWORDS,
  ABL_SNIPPETS,
} from "./keywords";

function wordRange(
  model: editor.ITextModel,
  position: Position
): IRange {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

export function createAblCompletionProvider(): languages.CompletionItemProvider {
  const uniqueKeywords = Array.from(
    new Set(ABL_KEYWORDS.map((k) => k.toUpperCase()))
  );
  const uniqueBuiltins = Array.from(
    new Set(ABL_BUILTIN_FUNCTIONS.map((k) => k.toUpperCase()))
  );

  return {
    triggerCharacters: [".", " ", "-"],
    provideCompletionItems(model, position) {
      const range = wordRange(model, position);

      const keywordItems: languages.CompletionItem[] = uniqueKeywords.map(
        (kw) => ({
          label: kw,
          kind: 17, // Keyword
          insertText: kw,
          range,
          detail: "ABL keyword",
        })
      );

      const builtinItems: languages.CompletionItem[] = uniqueBuiltins.map(
        (fn) => ({
          label: fn,
          kind: 1, // Function
          insertText: fn,
          range,
          detail: "Built-in function",
        })
      );

      const snippetItems: languages.CompletionItem[] = ABL_SNIPPETS.map(
        (s) => ({
          label: s.label,
          kind: 27, // Snippet
          insertText: s.insertText,
          insertTextRules: 4, // InsertAsSnippet
          range,
          detail: s.detail,
          documentation: s.detail,
        })
      );

      return {
        suggestions: [...snippetItems, ...keywordItems, ...builtinItems],
      };
    },
  };
}
