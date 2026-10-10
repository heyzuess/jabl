export type ThemeMode = "dark" | "light";

export type ThemeCustomization = {
  editorBackground: string;
  editorForeground: string;
  accent: string;
  comment: string;
  keyword: string;
};

export type PersistedTheme = {
  mode: ThemeMode;
  custom: ThemeCustomization;
};

const STORAGE_KEY = "jabl-theme";

export const DEFAULT_DARK_CUSTOM: ThemeCustomization = {
  editorBackground: "#1e1e1e",
  editorForeground: "#d4d4d4",
  accent: "#0e639c",
  comment: "#6a9955",
  keyword: "#569cd6",
};

export const DEFAULT_LIGHT_CUSTOM: ThemeCustomization = {
  editorBackground: "#ffffff",
  editorForeground: "#1e1e1e",
  accent: "#0078d4",
  comment: "#008000",
  keyword: "#0000ff",
};

export function loadTheme(): PersistedTheme {
  if (typeof window === "undefined") {
    return { mode: "dark", custom: { ...DEFAULT_DARK_CUSTOM } };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "dark", custom: { ...DEFAULT_DARK_CUSTOM } };
    const parsed = JSON.parse(raw) as PersistedTheme;
    return {
      mode: parsed.mode === "light" ? "light" : "dark",
      custom: {
        ...(parsed.mode === "light" ? DEFAULT_LIGHT_CUSTOM : DEFAULT_DARK_CUSTOM),
        ...parsed.custom,
      },
    };
  } catch {
    return { mode: "dark", custom: { ...DEFAULT_DARK_CUSTOM } };
  }
}

export function saveTheme(theme: PersistedTheme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function applyCssVars(mode: ThemeMode, custom: ThemeCustomization): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.setProperty("--ide-editor-bg", custom.editorBackground);
  root.style.setProperty("--ide-editor-fg", custom.editorForeground);
  root.style.setProperty("--ide-accent", custom.accent);
  root.style.setProperty("--ide-comment", custom.comment);
  root.style.setProperty("--ide-keyword", custom.keyword);
  root.style.setProperty("--primary", custom.accent);
}

export function buildMonacoTheme(
  mode: ThemeMode,
  custom: ThemeCustomization
): {
  base: "vs" | "vs-dark";
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
} {
  const fg = custom.editorForeground.replace("#", "");
  const comment = custom.comment.replace("#", "");
  const keyword = custom.keyword.replace("#", "");
  const stringColor = mode === "dark" ? "ce9178" : "a31515";
  const numberColor = mode === "dark" ? "b5cea8" : "098658";
  const preprocessorColor = mode === "dark" ? "c586c0" : "af00db";

  return {
    base: mode === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "comment.abl", foreground: comment, fontStyle: "italic" },
      { token: "keyword.abl", foreground: keyword },
      { token: "string.abl", foreground: stringColor },
      { token: "number.abl", foreground: numberColor },
      { token: "number.float.abl", foreground: numberColor },
      { token: "preprocessor.abl", foreground: preprocessorColor },
      { token: "identifier.abl", foreground: fg },
      { token: "operator.abl", foreground: fg },
      { token: "delimiter.abl", foreground: fg },
    ],
    colors: {
      "editor.background": custom.editorBackground,
      "editor.foreground": custom.editorForeground,
      "editorCursor.foreground": custom.editorForeground,
      "editorLineNumber.foreground": mode === "dark" ? "#858585" : "#237893",
      "editor.selectionBackground":
        mode === "dark" ? "#264f78" : "#add6ff",
      "editor.inactiveSelectionBackground":
        mode === "dark" ? "#3a3d41" : "#e5ebf1",
      focusBorder: custom.accent,
    },
  };
}

export const MONACO_THEME_NAME = "jabl-theme";
