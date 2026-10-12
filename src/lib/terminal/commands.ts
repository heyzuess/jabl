import type { WorkspaceState } from "@/lib/workspace/store";
import { findNode, normalizePath } from "@/lib/workspace/fs-access";
import { languageIdForPath } from "@/lib/abl/register";
import {
  checkAblSyntax,
  formatDiagnostics,
} from "@/lib/abl/syntax-check";
import {
  clearBreakpoint,
  continueDebug,
  listVars,
  quitDebug,
  setBreakpoint,
  startDebug,
  stepDebug,
} from "@/lib/debug/session";
import { executeAbl } from "@/lib/oe/execute";
import { useGitStore } from "@/lib/git/store";
import { toRepoRelativePath } from "@/lib/git/git-service";

export type TerminalApi = {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
};

type RunnerDeps = {
  getState: () => WorkspaceState;
  api: TerminalApi;
};

export function getPrompt(state: WorkspaceState): string {
  const cwd = state.cwd || state.rootName || "~";
  return `jabl:${cwd}> `;
}

export async function runCommand(
  line: string,
  { getState, api }: RunnerDeps
): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  const parts = splitArgs(trimmed);
  const cmd = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);
  const state = getState();

  switch (cmd) {
    case "help":
      api.writeln("Project-scoped terminal (no OS shell). Commands:");
      api.writeln("  help              Show this help");
      api.writeln("  clear             Clear the terminal");
      api.writeln("  pwd               Print virtual working directory");
      api.writeln("  ls [path]         List files in the opened tree");
      api.writeln("  cat <path>        Print a text file from the tree");
      api.writeln("  echo [text…]      Echo arguments");
      api.writeln("  cd [path]         Change virtual directory");
      api.writeln("  check [path]      Run ABL syntax check (active file if omitted)");
      api.writeln("  compile [path]    Compile via OpenEdge agent → Output pane");
      api.writeln("  run [path]        Run via OpenEdge agent → Output pane");
      api.writeln("  debug [path]      Start simulated line debugger");
      api.writeln("  break <n>         Set breakpoint at line n");
      api.writeln("  clearbp [n]       Clear breakpoint n (or all)");
      api.writeln("  clear <n>         Clear breakpoint at line n");
      api.writeln("  step              Step to next executable line");
      api.writeln("  continue          Run to next breakpoint or end");
      api.writeln("  vars              Show inferred variables");
      api.writeln("  quit              End debug session");
      api.writeln("  git status        Show repo status (fs-access + .git)");
      api.writeln("  git add <path>| . Stage files");
      api.writeln("  git restore --staged <path>  Unstage");
      api.writeln("  git commit -m msg Commit staged changes");
      api.writeln("  git branch        Show current branch");
      break;

    case "clear":
      if (args[0]) {
        const n = Number(args[0]);
        if (!Number.isInteger(n)) {
          api.writeln("Usage: clear <line>  (or 'clear' with no args to wipe terminal)");
          break;
        }
        for (const l of clearBreakpoint(n).lines) api.writeln(l);
      } else {
        api.clear();
      }
      break;

    case "clearbp": {
      if (!args[0]) {
        for (const l of clearBreakpoint().lines) api.writeln(l);
      } else {
        const n = Number(args[0]);
        if (!Number.isInteger(n)) {
          api.writeln("Usage: clearbp [line]");
          break;
        }
        for (const l of clearBreakpoint(n).lines) api.writeln(l);
      }
      break;
    }

    case "pwd":
      if (!state.root) {
        api.writeln("No workspace open. Use Open Folder or Load Samples.");
      } else {
        api.writeln(state.cwd || state.rootName);
      }
      break;

    case "echo":
      api.writeln(args.join(" "));
      break;

    case "ls": {
      if (!state.root) {
        api.writeln("No workspace open.");
        break;
      }
      const target = args[0];
      const entries = state.listAt(target);
      if (!entries.length) {
        const path = target
          ? normalizePath(target, state.rootName)
          : state.cwd;
        const node = findNode(state.root, path);
        if (!node) {
          api.writeln(`ls: cannot access '${target ?? "."}': No such path`);
        } else if (node.kind === "file") {
          api.writeln(node.name);
        } else {
          api.writeln("(empty)");
        }
        break;
      }
      for (const e of entries) {
        const suffix = e.kind === "directory" ? "/" : "";
        api.writeln(`${e.name}${suffix}`);
      }
      break;
    }

    case "cat": {
      if (!args[0]) {
        api.writeln("Usage: cat <path>");
        break;
      }
      if (!state.root) {
        api.writeln("No workspace open.");
        break;
      }
      try {
        const content = await state.readAt(args[0]);
        for (const line of content.split(/\r?\n/)) {
          api.writeln(line);
        }
      } catch (err) {
        api.writeln(`cat: ${(err as Error).message}`);
      }
      break;
    }

    case "cd": {
      if (!state.root) {
        api.writeln("No workspace open.");
        break;
      }
      const dest = args[0] || state.rootName;
      if (dest === "..") {
        const partsPath = (state.cwd || state.rootName).split("/");
        if (partsPath.length > 1) {
          partsPath.pop();
          state.setCwd(partsPath.join("/"));
        }
        break;
      }
      const normalized = normalizePath(
        dest.includes("/") || dest === state.rootName
          ? dest
          : `${state.cwd}/${dest}`,
        state.rootName
      );
      const node = findNode(state.root, normalized);
      if (!node || node.kind !== "directory") {
        api.writeln(`cd: no such directory: ${dest}`);
      } else {
        state.setCwd(normalized);
      }
      break;
    }

    case "check": {
      const resolved = await resolveSourcePath(args[0], state, api);
      if (!resolved) break;
      if (languageIdForPath(resolved.path) !== "abl") {
        api.writeln(`check: not an ABL file: ${resolved.path}`);
        break;
      }
      const diags = checkAblSyntax(resolved.source);
      for (const line of formatDiagnostics(resolved.path, diags)) {
        api.writeln(line);
      }
      const firstErr = diags.find((d) => d.severity === "error") ?? diags[0];
      state.requestSyntaxCheck(
        firstErr
          ? {
              path: resolved.path,
              line: firstErr.line,
              column: firstErr.column,
            }
          : null
      );
      if (resolved.path !== state.activePath) {
        void state.openFile(resolved.path);
      }
      break;
    }

    case "compile":
    case "run": {
      const resolved = await resolveSourcePath(args[0], state, api);
      if (!resolved) break;
      if (languageIdForPath(resolved.path) !== "abl") {
        api.writeln(`${cmd}: not an ABL file: ${resolved.path}`);
        break;
      }
      if (resolved.path !== state.activePath) {
        void state.openFile(resolved.path);
      }
      api.writeln(
        `${cmd === "run" ? "Running" : "Compiling"} ${resolved.path} (see Output pane)…`
      );
      const result = await executeAbl(
        cmd === "run" ? "run" : "compile",
        resolved.path
      );
      api.writeln(result.message);
      break;
    }

    case "debug": {
      const resolved = await resolveSourcePath(args[0], state, api);
      if (!resolved) break;
      if (languageIdForPath(resolved.path) !== "abl") {
        api.writeln(`debug: not an ABL file: ${resolved.path}`);
        break;
      }
      const result = startDebug(resolved.path, resolved.source);
      for (const l of result.lines) api.writeln(l);
      state.setStatus(`Debugging ${resolved.path}`);
      if (resolved.path !== state.activePath) {
        void state.openFile(resolved.path);
      }
      break;
    }

    case "break": {
      if (!args[0]) {
        api.writeln("Usage: break <line>");
        break;
      }
      const n = Number(args[0]);
      if (!Number.isInteger(n)) {
        api.writeln("Usage: break <line>");
        break;
      }
      for (const l of setBreakpoint(n).lines) api.writeln(l);
      break;
    }

    case "step":
      for (const l of stepDebug().lines) api.writeln(l);
      break;

    case "continue":
      for (const l of continueDebug().lines) api.writeln(l);
      break;

    case "vars":
      for (const l of listVars().lines) api.writeln(l);
      break;

    case "quit":
      for (const l of quitDebug().lines) api.writeln(l);
      state.setStatus(null);
      break;

    case "git":
      await runGitCommand(args, state, api);
      break;

    default:
      api.writeln(
        `Unknown command: ${cmd}. Type 'help' for available commands.`
      );
  }
}

async function runGitCommand(
  args: string[],
  state: WorkspaceState,
  api: TerminalApi
): Promise<void> {
  const sub = (args[0] ?? "").toLowerCase();
  const git = useGitStore.getState();

  if (!sub || sub === "help") {
    api.writeln("git commands (browser isomorphic-git, not OS git):");
    api.writeln("  git status");
    api.writeln("  git add <path>… | git add .");
    api.writeln("  git restore --staged <path>…");
    api.writeln("  git commit -m \"message\"");
    api.writeln("  git branch");
    return;
  }

  const refreshAnd = async (fn: () => Promise<void>) => {
    await fn();
    await git.refresh();
  };

  switch (sub) {
    case "status": {
      await git.refresh();
      const s = useGitStore.getState();
      if (!s.available) {
        api.writeln(s.error ?? "Git not available.");
        return;
      }
      api.writeln(`On branch ${s.branch ?? "HEAD"}`);
      if (s.staged.length) {
        api.writeln("Changes to be committed:");
        for (const c of s.staged) api.writeln(`  ${c.status}: ${c.filepath}`);
      }
      if (s.unstaged.length) {
        api.writeln("Changes not staged for commit:");
        for (const c of s.unstaged) api.writeln(`  ${c.status}: ${c.filepath}`);
      }
      if (s.untracked.length) {
        api.writeln("Untracked files:");
        for (const c of s.untracked) api.writeln(`  ${c.filepath}`);
      }
      if (!s.staged.length && !s.unstaged.length && !s.untracked.length) {
        api.writeln("nothing to commit, working tree clean");
      }
      return;
    }

    case "add": {
      if (!args[1]) {
        api.writeln("Usage: git add <path>… | git add .");
        return;
      }
      if (args[1] === ".") {
        await refreshAnd(async () => {
          await useGitStore.getState().stageAllChanges();
        });
        api.writeln("staged all changes");
        return;
      }
      const paths = args.slice(1).map((p) =>
        toRepoRelativePath(p, state.rootName, state.cwd || state.rootName)
      );
      await refreshAnd(async () => {
        await useGitStore.getState().stage(paths);
      });
      const err = useGitStore.getState().error;
      if (err) api.writeln(err);
      else api.writeln(`staged ${paths.join(", ")}`);
      return;
    }

    case "restore": {
      if (args[1] !== "--staged" || !args[2]) {
        api.writeln("Usage: git restore --staged <path>…");
        return;
      }
      const paths = args.slice(2).map((p) =>
        toRepoRelativePath(p, state.rootName, state.cwd || state.rootName)
      );
      await refreshAnd(async () => {
        await useGitStore.getState().unstage(paths);
      });
      const err = useGitStore.getState().error;
      if (err) api.writeln(err);
      else api.writeln(`unstaged ${paths.join(", ")}`);
      return;
    }

    case "commit": {
      let message = "";
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "-m" && args[i + 1]) {
          message = args[i + 1]!;
          break;
        }
      }
      if (!message) {
        api.writeln('Usage: git commit -m "message"');
        return;
      }
      try {
        const sha = await git.commit(message);
        api.writeln(`[${useGitStore.getState().branch ?? "HEAD"} ${sha.slice(0, 7)}] ${message}`);
      } catch (err) {
        api.writeln(`commit failed: ${(err as Error).message}`);
      }
      return;
    }

    case "branch": {
      await git.refresh();
      const s = useGitStore.getState();
      if (!s.available) {
        api.writeln(s.error ?? "Git not available.");
        return;
      }
      api.writeln(`* ${s.branch ?? "HEAD"}`);
      return;
    }

    default:
      api.writeln(
        `git ${sub}: not supported in v1. Try status, add, restore --staged, commit, branch.`
      );
  }
}

async function resolveSourcePath(
  arg: string | undefined,
  state: WorkspaceState,
  api: TerminalApi
): Promise<{ path: string; source: string } | null> {
  const path = arg
    ? normalizePath(
        arg.includes("/") || (state.rootName && arg.startsWith(state.rootName))
          ? arg
          : `${state.cwd || state.rootName}/${arg}`,
        state.rootName || "workspace"
      )
    : state.activePath;

  // For relative args without rootName prefix, also try readAt's cwd logic
  if (!path) {
    api.writeln("No file specified. Open a file or pass a path.");
    return null;
  }

  try {
    let source: string;
    if (arg) {
      source = await state.readAt(arg);
      // Prefer normalized path from buffer keys when possible
      const fromBuffer = Object.keys(state.buffers).find(
        (p) => p === path || p.endsWith(`/${arg}`) || p === arg
      );
      return { path: fromBuffer ?? path, source };
    }
    source = state.buffers[path] ?? (await state.readAt(path));
    return { path, source };
  } catch (err) {
    api.writeln(`${(err as Error).message}`);
    return null;
  }
}

function splitArgs(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}
