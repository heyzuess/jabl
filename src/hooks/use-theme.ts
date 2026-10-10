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

function withModeDefaults(
  prev: PersistedTheme,
  mode: ThemeMode
): PersistedTheme {
  const defaults =
    mode === "dark" ? DEFAULT_DARK_CUSTOM : DEFAULT_LIGHT_CUSTOM;
  return {
    mode,
    custom: {
      ...prev.custom,
      editorBackground:
        prev.custom.editorBackground ===
          (prev.mode === "dark"
            ? DEFAULT_DARK_CUSTOM.editorBackground
            : DEFAULT_LIGHT_CUSTOM.editorBackground)
          ? defaults.editorBackground
          : prev.custom.editorBackground,
      editorForeground:
        prev.custom.editorForeground ===
          (prev.mode === "dark"
            ? DEFAULT_DARK_CUSTOM.editorForeground
            : DEFAULT_LIGHT_CUSTOM.editorForeground)
          ? defaults.editorForeground
          : prev.custom.editorForeground,
    },
  };
}

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

  const setMode = useCallback((mode: ThemeMode) => {
    setTheme((prev) => {
      const next = withModeDefaults(prev, mode);
      saveTheme(next);
      applyCssVars(next.mode, next.custom);
      return next;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setTheme((prev) => {
      const next = withModeDefaults(
        prev,
        prev.mode === "dark" ? "light" : "dark"
      );
      saveTheme(next);
      applyCssVars(next.mode, next.custom);
      return next;
    });
  }, []);

  const updateCustom = useCallback((partial: Partial<ThemeCustomization>) => {
    setTheme((prev) => {
      const next: PersistedTheme = {
        mode: prev.mode,
        custom: { ...prev.custom, ...partial },
      };
      saveTheme(next);
      applyCssVars(next.mode, next.custom);
      return next;
    });
  }, []);

  const resetCustom = useCallback(() => {
    setTheme((prev) => {
      const defaults =
        prev.mode === "dark" ? DEFAULT_DARK_CUSTOM : DEFAULT_LIGHT_CUSTOM;
      const next: PersistedTheme = {
        mode: prev.mode,
        custom: { ...defaults },
      };
      saveTheme(next);
      applyCssVars(next.mode, next.custom);
      return next;
    });
  }, []);

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
