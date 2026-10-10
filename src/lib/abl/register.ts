import type * as Monaco from "monaco-editor";
import { ablLanguageConfig, ablMonarchTokens } from "./monarch";
import { createAblCompletionProvider } from "./completions";
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
