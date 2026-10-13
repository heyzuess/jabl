"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getPrompt, runCommand } from "@/lib/terminal/commands";
import { useWorkspaceStore } from "@/lib/workspace/store";
import type { ThemeMode } from "@/lib/theme/themes";
import { PaneChrome } from "./PaneChrome";

type TerminalPaneProps = {
  mode: ThemeMode;
  editorBg: string;
  editorFg: string;
  accent: string;
};

type TermApi = {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
  printPrompt: () => void;
};

export function TerminalPane({
  mode,
  editorBg,
  editorFg,
  accent,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineRef = useRef("");
  const apiRef = useRef<TermApi | null>(null);
  const busyRef = useRef(false);
  const cwdRef = useRef("");
  useEffect(() => {
    cwdRef.current = useWorkspaceStore.getState().cwd;
    return useWorkspaceStore.subscribe((s) => {
      cwdRef.current = s.cwd;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: editorBg,
        foreground: editorFg,
        cursor: editorFg,
        selectionBackground: accent + "66",
      },
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const writeln = (text: string) => term.writeln(text);
    const write = (text: string) => term.write(text);
    const clear = () => term.clear();

    const printPrompt = () => {
      write(getPrompt(useWorkspaceStore.getState()));
    };

    apiRef.current = { write, writeln, clear, printPrompt };

    const runLine = async (line: string) => {
      busyRef.current = true;
      try {
        await runCommand(line, {
          getState: () => useWorkspaceStore.getState(),
          api: { write, writeln, clear },
        });
      } finally {
        busyRef.current = false;
        printPrompt();
      }
    };

    term.writeln("JABL project terminal — type 'help' for commands.");
    printPrompt();

    term.onData((data) => {
      if (busyRef.current) return;
      for (const ch of data) {
        if (ch === "\r") {
          term.write("\r\n");
          const line = lineRef.current;
          lineRef.current = "";
          void runLine(line);
        } else if (ch === "\u007f") {
          // Backspace
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1);
            term.write("\b \b");
          }
        } else if (ch === "\u0003") {
          // Ctrl+C
          term.write("^C\r\n");
          lineRef.current = "";
          printPrompt();
        } else if (ch === "\u000c") {
          // Ctrl+L
          clear();
          printPrompt();
        } else if (ch >= " ") {
          lineRef.current += ch;
          term.write(ch);
        }
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      apiRef.current = null;
    };
    // Mount once; theme updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menu → terminal inject bridge
  useEffect(() => {
    return useWorkspaceStore.subscribe((s, prev) => {
      const cmd = s.terminalInject;
      if (!cmd || cmd === prev.terminalInject) return;
      const term = termRef.current;
      const api = apiRef.current;
      if (!term || !api || busyRef.current) {
        useWorkspaceStore.getState().clearTerminalInject();
        return;
      }
      // Discard any partial typed input, echo injected command, run it
      if (lineRef.current.length > 0) {
        term.write("\r\n");
        lineRef.current = "";
      } else {
        // Move to new line after current prompt content if needed — prompt already shown
      }
      term.write(`${cmd}\r\n`);
      useWorkspaceStore.getState().clearTerminalInject();
      busyRef.current = true;
      void (async () => {
        try {
          await runCommand(cmd, {
            getState: () => useWorkspaceStore.getState(),
            api: {
              write: api.write,
              writeln: api.writeln,
              clear: api.clear,
            },
          });
        } finally {
          busyRef.current = false;
          api.printPrompt();
        }
      })();
    });
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = {
      background: editorBg,
      foreground: editorFg,
      cursor: editorFg,
      selectionBackground: accent + "66",
    };
  }, [mode, editorBg, editorFg, accent]);

  return (
    <div className="flex h-full flex-col bg-[var(--ide-editor-bg)]">
      <PaneChrome pane="terminal" title="Terminal" />
      <div ref={containerRef} className="min-h-0 flex-1 px-1 py-1" />
    </div>
  );
}
