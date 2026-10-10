"use client";

import { useCallback, useEffect, useState } from "react";
import type * as Monaco from "monaco-editor";
import {
  applyCssVars,
  buildMonacoTheme,
  DEFAULT_DARK_CUSTOM,
  DEFAULT_LIGHT_CUSTOM,
  loadTheme,
  MONACO_THEME_NAME,
  saveTheme,
  type PersistedTheme,
  type ThemeCustomization,
  type ThemeMode,
} from "@/lib/theme/themes";

export function useIdeTheme() {
  const [theme, setTheme] = useState<PersistedTheme>({
    mode: "dark",
    custom: { ...DEFAULT_DARK_CUSTOM },
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadTheme();
    setTheme(loaded);
    applyCssVars(loaded.mode, loaded.custom);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PersistedTheme) => {
    setTheme(next);
    saveTheme(next);
    applyCssVars(next.mode, next.custom);
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      const defaults =
        mode === "dark" ? DEFAULT_DARK_CUSTOM : DEFAULT_LIGHT_CUSTOM;
      // Keep custom token colors when toggling, but swap bg/fg defaults if still on previous defaults
      persist({
        mode,
        custom: {
          ...theme.custom,
          editorBackground:
            theme.custom.editorBackground ===
              (theme.mode === "dark"
                ? DEFAULT_DARK_CUSTOM.editorBackground
                : DEFAULT_LIGHT_CUSTOM.editorBackground)
              ? defaults.editorBackground
              : theme.custom.editorBackground,
          editorForeground:
            theme.custom.editorForeground ===
              (theme.mode === "dark"
                ? DEFAULT_DARK_CUSTOM.editorForeground
                : DEFAULT_LIGHT_CUSTOM.editorForeground)
              ? defaults.editorForeground
              : theme.custom.editorForeground,
        },
      });
    },
    [persist, theme]
  );

  const toggleMode = useCallback(() => {
    setMode(theme.mode === "dark" ? "light" : "dark");
  }, [setMode, theme.mode]);

  const updateCustom = useCallback(
    (partial: Partial<ThemeCustomization>) => {
      persist({
        mode: theme.mode,
        custom: { ...theme.custom, ...partial },
      });
    },
    [persist, theme]
  );

  const resetCustom = useCallback(() => {
    const defaults =
      theme.mode === "dark" ? DEFAULT_DARK_CUSTOM : DEFAULT_LIGHT_CUSTOM;
    persist({ mode: theme.mode, custom: { ...defaults } });
  }, [persist, theme.mode]);

  const applyToMonaco = useCallback(
    (monaco: typeof Monaco) => {
      const def = buildMonacoTheme(theme.mode, theme.custom);
      monaco.editor.defineTheme(MONACO_THEME_NAME, def);
      monaco.editor.setTheme(MONACO_THEME_NAME);
    },
    [theme]
  );

  return {
    theme,
    hydrated,
    setMode,
    toggleMode,
    updateCustom,
    resetCustom,
    applyToMonaco,
  };
}
