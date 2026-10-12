import http from "isomorphic-git/http/web";
import {
  clearStoredCredential,
  getAppCorsProxy,
  getStoredCredential,
  hostFromGitUrl,
  setStoredCredential,
  type GitCredential,
} from "./credentials";

export type AuthPromptResult = {
  username: string;
  password: string;
  remember: boolean;
} | null;

export type AuthPromptFn = (info: {
  url: string;
  host: string;
  reason: "needed" | "rejected";
}) => Promise<AuthPromptResult>;

export type ProgressFn = (event: {
  phase: string;
  loaded: number;
  total: number;
}) => void;

let authPromptFn: AuthPromptFn | null = null;

/** Register UI handler for credential prompts (called from git store). */
export function setAuthPromptHandler(fn: AuthPromptFn | null): void {
  authPromptFn = fn;
}

async function promptAuth(
  url: string,
  reason: "needed" | "rejected"
): Promise<GitCredential | undefined> {
  const host = hostFromGitUrl(url);
  if (authPromptFn) {
    const result = await authPromptFn({ url, host, reason });
    if (!result) return undefined;
    const cred: GitCredential = {
      username: result.username.trim(),
      password: result.password,
    };
    if (!cred.username || !cred.password) return undefined;
    if (result.remember) setStoredCredential(host, cred);
    return cred;
  }

  // Fallback when no UI handler is registered (e.g. terminal-only)
  const username =
    window.prompt(`Git username for ${host}:`, "")?.trim() ?? "";
  if (!username) return undefined;
  const password =
    window.prompt(`Personal access token / password for ${host}:`, "") ?? "";
  if (!password) return undefined;
  const remember = window.confirm(`Remember credentials for ${host}?`);
  const cred = { username, password };
  if (remember) setStoredCredential(host, cred);
  return cred;
}

export function assertHttpsRemoteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Remote URL is required");
  if (/^git@|^ssh:\/\//i.test(trimmed)) {
    throw new Error(
      "SSH remotes are not supported in the browser. Use an HTTPS URL."
    );
  }
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error("Remote URL must be HTTPS (https://…)");
  }
  return trimmed;
}

export type RemoteHttpOptions = {
  http: typeof http;
  corsProxy: string | undefined;
  onAuth: (url: string) => Promise<GitCredential | undefined>;
  onAuthFailure: (url: string) => Promise<GitCredential | undefined>;
  onProgress?: ProgressFn;
};

/**
 * Build shared isomorphic-git HTTP options.
 * `corsProxy` empty string means no proxy; undefined uses app default.
 */
export function buildRemoteHttpOptions(opts?: {
  corsProxy?: string | null;
  onProgress?: ProgressFn;
}): RemoteHttpOptions {
  const fromArg = opts?.corsProxy;
  const proxy =
    fromArg === null
      ? undefined
      : fromArg !== undefined
        ? fromArg.trim() || undefined
        : getAppCorsProxy() || undefined;

  return {
    http,
    corsProxy: proxy,
    onProgress: opts?.onProgress,
    onAuth: async (url) => {
      const host = hostFromGitUrl(url);
      const stored = getStoredCredential(host);
      if (stored) return stored;
      return promptAuth(url, "needed");
    },
    onAuthFailure: async (url) => {
      const host = hostFromGitUrl(url);
      clearStoredCredential(host);
      return promptAuth(url, "rejected");
    },
  };
}

export function formatRemoteError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Failed to fetch|NetworkError|CORS|cors/i.test(msg)) {
    return `${msg} — set a CORS proxy (default: ${getAppCorsProxy() || "(none)"}) under Remotes, or configure http.corsProxy.`;
  }
  if (/401|Unauthorized|auth/i.test(msg)) {
    return `${msg} — check username / personal access token.`;
  }
  return msg;
}
