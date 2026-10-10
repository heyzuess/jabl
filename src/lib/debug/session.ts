/** Simulated ABL source-line debugger (no Progress runtime). */

export type DebugStatus = "idle" | "paused" | "finished";

export type DebugSession = {
  path: string;
  lines: string[];
  currentLine: number; // 1-based, 0 when idle/finished
  breakpoints: Set<number>;
  status: DebugStatus;
  vars: Record<string, string>;
};

export type DebugResult = {
  ok: boolean;
  lines: string[];
};

let session: DebugSession | null = null;

export function getDebugSession(): DebugSession | null {
  return session;
}

export function startDebug(path: string, source: string): DebugResult {
  const lines = source.split(/\r?\n/);
  const vars = extractVariables(source);
  const first = firstExecutableLine(lines);
  if (first == null) {
    session = {
      path,
      lines,
      currentLine: 0,
      breakpoints: new Set(),
      status: "finished",
      vars,
    };
    return {
      ok: true,
      lines: [
        `Debug session started: ${path} (simulated — no Progress runtime)`,
        "No executable lines found.",
        "Session finished. Type 'quit' to clear.",
      ],
    };
  }

  session = {
    path,
    lines,
    currentLine: first,
    breakpoints: new Set(),
    status: "paused",
    vars,
  };

  return {
    ok: true,
    lines: [
      `Debug session started: ${path} (simulated — no Progress runtime)`,
      "Commands: break <n>, clear [n], step, continue, vars, quit",
      formatPause(session),
    ],
  };
}

export function setBreakpoint(line: number): DebugResult {
  if (!session || session.status === "idle") {
    return { ok: false, lines: ["No active debug session. Use: debug [path]"] };
  }
  if (!Number.isInteger(line) || line < 1 || line > session.lines.length) {
    return {
      ok: false,
      lines: [`Invalid line: ${line} (1–${session.lines.length})`],
    };
  }
  session.breakpoints.add(line);
  return { ok: true, lines: [`Breakpoint set at line ${line}`] };
}

export function clearBreakpoint(line?: number): DebugResult {
  if (!session || session.status === "idle") {
    return { ok: false, lines: ["No active debug session. Use: debug [path]"] };
  }
  if (line == null) {
    session.breakpoints.clear();
    return { ok: true, lines: ["All breakpoints cleared"] };
  }
  if (!session.breakpoints.has(line)) {
    return { ok: false, lines: [`No breakpoint at line ${line}`] };
  }
  session.breakpoints.delete(line);
  return { ok: true, lines: [`Breakpoint cleared at line ${line}`] };
}

export function stepDebug(): DebugResult {
  if (!requirePaused()) {
    return sessionStatusError();
  }
  const next = nextExecutableLine(session!.lines, session!.currentLine + 1);
  if (next == null) {
    session!.status = "finished";
    session!.currentLine = 0;
    return { ok: true, lines: ["Finished — end of file."] };
  }
  session!.currentLine = next;
  applyLineSideEffects(session!, next);
  return { ok: true, lines: [formatPause(session!)] };
}

export function continueDebug(): DebugResult {
  if (!requirePaused()) {
    return sessionStatusError();
  }
  let line = session!.currentLine + 1;
  while (line <= session!.lines.length) {
    if (session!.breakpoints.has(line)) {
      session!.currentLine = line;
      if (isExecutableLine(session!.lines[line - 1])) {
        applyLineSideEffects(session!, line);
      }
      return {
        ok: true,
        lines: [`Hit breakpoint at line ${line}`, formatPause(session!)],
      };
    }
    if (isExecutableLine(session!.lines[line - 1])) {
      applyLineSideEffects(session!, line);
    }
    line++;
  }
  session!.status = "finished";
  session!.currentLine = 0;
  return { ok: true, lines: ["Finished — end of file (no further breakpoints)."] };
}

export function listVars(): DebugResult {
  if (!session || session.status === "idle") {
    return { ok: false, lines: ["No active debug session. Use: debug [path]"] };
  }
  const keys = Object.keys(session.vars);
  if (!keys.length) {
    return { ok: true, lines: ["(no variables inferred)"] };
  }
  return {
    ok: true,
    lines: keys.map((k) => `  ${k} = ${session!.vars[k]}`),
  };
}

export function quitDebug(): DebugResult {
  if (!session) {
    return { ok: false, lines: ["No active debug session."] };
  }
  const path = session.path;
  session = null;
  return { ok: true, lines: [`Debug session ended: ${path}`] };
}

function requirePaused(): boolean {
  return !!session && session.status === "paused";
}

function sessionStatusError(): DebugResult {
  if (!session || session.status === "idle") {
    return { ok: false, lines: ["No active debug session. Use: debug [path]"] };
  }
  if (session.status === "finished") {
    return {
      ok: false,
      lines: ["Session finished. Type 'quit' or 'debug [path]' to restart."],
    };
  }
  return { ok: false, lines: ["Debugger is not paused."] };
}

function formatPause(s: DebugSession): string {
  const text = s.lines[s.currentLine - 1] ?? "";
  return `→ L${String(s.currentLine).padStart(3, " ")} | ${text}`;
}

function firstExecutableLine(lines: string[]): number | null {
  return nextExecutableLine(lines, 1);
}

function nextExecutableLine(
  lines: string[],
  from: number
): number | null {
  for (let i = from; i <= lines.length; i++) {
    if (isExecutableLine(lines[i - 1])) return i;
  }
  return null;
}

function isExecutableLine(line: string | undefined): boolean {
  if (line == null) return false;
  const trimmed = stripCommentNoise(line).trim();
  if (!trimmed) return false;
  return true;
}

function stripCommentNoise(line: string): string {
  let s = line.replace(/\/\*[\s\S]*?\*\//g, "");
  const slash = s.indexOf("//");
  if (slash >= 0) s = s.slice(0, slash);
  return s;
}

/** Infer DEFINE VARIABLE … INITIAL and simple assignments. */
export function extractVariables(source: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const defineRe =
    /\bDEFINE\s+(?:(?:PUBLIC|PROTECTED|PRIVATE|STATIC)\s+)*VARIABLE\s+([A-Za-z_][\w-]*)\s+AS\s+\w+(?:\s+NO-UNDO)?(?:\s+INITIAL\s+((?:"(?:[^"]|"")*")|(?:'(?:[^']|'')*')|[^\s.]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = defineRe.exec(source)) != null) {
    vars[m[1]] = m[2] != null ? m[2] : "?";
  }

  const assignRe =
    /^\s*([A-Za-z_][\w-]*)\s*=\s*(.+?)\.?\s*$/gm;
  while ((m = assignRe.exec(source)) != null) {
    const name = m[1];
    if (vars[name] != null || /^[A-Z][A-Z0-9_-]*$/.test(name)) {
      // Prefer known vars; skip ALL-CAPS keyword-looking LHS unless already defined
      if (vars[name] != null) {
        vars[name] = m[2].replace(/\.$/, "").trim();
      }
    }
  }

  return vars;
}

function applyLineSideEffects(s: DebugSession, lineNo: number): void {
  const line = s.lines[lineNo - 1] ?? "";
  const defineRe =
    /\bDEFINE\s+(?:(?:PUBLIC|PROTECTED|PRIVATE|STATIC)\s+)*VARIABLE\s+([A-Za-z_][\w-]*)\s+AS\s+\w+(?:\s+NO-UNDO)?(?:\s+INITIAL\s+((?:"(?:[^"]|"")*")|(?:'(?:[^']|'')*')|[^\s.]+))?/i;
  const dm = defineRe.exec(line);
  if (dm) {
    s.vars[dm[1]] = dm[2] != null ? dm[2] : "?";
  }
  const assignRe = /^\s*([A-Za-z_][\w-]*)\s*=\s*(.+?)\.?\s*$/;
  const am = assignRe.exec(stripCommentNoise(line));
  if (am && s.vars[am[1]] != null) {
    s.vars[am[1]] = am[2].replace(/\.$/, "").trim();
  }
}
