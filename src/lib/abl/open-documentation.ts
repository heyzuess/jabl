import { getBuiltinType } from "./builtin/builtin-types";
import { useDocumentationStore } from "./documentation-store";
import { useLayoutStore } from "@/lib/workspace/layout-store";
import { getAblDocEntry } from "./reference";
import type { AblSymbol } from "./symbols";

/** Payload from hover “Open in Documentation” command links. */
export type OpenDocArg =
  | string
  | {
      name: string;
      kind: string;
      detail: string;
      signature: string;
      excerpt: string;
      path?: string | null;
    };

export function openAblDocumentation(arg: OpenDocArg): void {
  useLayoutStore.getState().revealDocumentation();

  if (typeof arg === "string") {
    if (getBuiltinType(arg)) {
      useDocumentationStore.getState().openBuiltinDoc(arg);
      return;
    }
    if (getAblDocEntry(arg)) {
      useDocumentationStore.getState().openLanguageDoc(arg);
      return;
    }
    // Fallback: try builtin short / language
    useDocumentationStore.getState().openLanguageDoc(arg);
    return;
  }

  if (arg && typeof arg === "object" && arg.name) {
    const kind = normalizeSymbolKind(arg.kind);
    const symbol: AblSymbol = {
      name: arg.name,
      kind,
      detail: arg.detail || arg.kind || "Symbol",
      signature: arg.signature || arg.name,
      excerpt: arg.excerpt || arg.signature || arg.name,
      path: arg.path ?? undefined,
      startLine: 1,
      endLine: 1,
    };
    useDocumentationStore.getState().openSymbolDoc(symbol);
    return;
  }
}

function normalizeSymbolKind(kind: string): AblSymbol["kind"] {
  const k = kind.toLowerCase();
  const allowed: AblSymbol["kind"][] = [
    "function",
    "procedure",
    "class",
    "interface",
    "enum",
    "method",
    "property",
    "constructor",
    "destructor",
    "define",
    "variable",
    "type",
  ];
  return (allowed.find((a) => a === k) ?? "type") as AblSymbol["kind"];
}
