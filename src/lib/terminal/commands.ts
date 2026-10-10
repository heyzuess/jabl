import type { WorkspaceState } from "@/lib/workspace/store";
import { findNode, normalizePath } from "@/lib/workspace/fs-access";

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
      break;

    case "clear":
      api.clear();
      break;

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

    default:
      api.writeln(
        `Unknown command: ${cmd}. Type 'help' for available commands.`
      );
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
