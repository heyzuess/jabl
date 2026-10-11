export type OeMode = "compile" | "run";

export type OeCompileMessage = {
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
};

export type OeRunRequest = {
  mode: OeMode;
  entry: string;
  files: Record<string, string>;
  propath?: string[];
};

export type OeRunResponse = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  compileMessages: OeCompileMessage[];
  error?: string;
};

export type OutputEntry = {
  id: string;
  timestamp: number;
  mode: OeMode;
  entry: string;
  status: "running" | "ok" | "error";
  stdout: string;
  stderr: string;
  compileMessages: OeCompileMessage[];
  missing: string[];
  error?: string;
};
