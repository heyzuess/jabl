import type * as Monaco from "monaco-editor";
import { ablLanguageConfig, ablMonarchTokens } from "./monarch";
import { createAblCompletionProvider } from "./completions";
import { createAblHoverProvider } from "./hover";
import { OPEN_DOC_COMMAND } from "./docs";
import { openAblDocumentation, type OpenDocArg } from "./open-documentation";
import { ABL_EXTENSIONS } from "./keywords";

let registered = false;

export function registerAblLanguage(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({
    id: "abl",
    extensions: [...ABL_EXTENSIONS],
    aliases: ["OpenEdge ABL", "ABL", "Progress"],
    mimetypes: ["text/x-abl"],
  });

  monaco.languages.setLanguageConfiguration("abl", ablLanguageConfig);
  monaco.languages.setMonarchTokensProvider("abl", ablMonarchTokens);
  monaco.languages.registerCompletionItemProvider(
    "abl",
    createAblCompletionProvider()
  );
  monaco.languages.registerHoverProvider("abl", createAblHoverProvider());

  // Hover “Open in Documentation ▸” command links (trusted markdown)
  monaco.editor.registerCommand(
    OPEN_DOC_COMMAND,
    (_accessor: unknown, ...args: unknown[]) => {
      const first = args[0] as OpenDocArg | undefined;
      if (first != null) openAblDocumentation(first);
    }
  );
}

export function languageIdForPath(path: string): string {
  const lower = path.toLowerCase();
  if (ABL_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "abl";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".sql")) return "sql";
  return "plaintext";
}
