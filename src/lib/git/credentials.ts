export type GitCredential = {
  username: string;
  password: string;
};

const CRED_PREFIX = "jabl.git.credentials.";
const CORS_KEY = "jabl.git.corsProxy";

/** Public isomorphic-git CORS proxy — used when no repo/app proxy is set. */
export const DEFAULT_CORS_PROXY = "https://cors.isomorphic-git.org";

export function hostFromGitUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

export function getStoredCredential(host: string): GitCredential | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CRED_PREFIX + host);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GitCredential>;
    if (
      typeof parsed.username === "string" &&
      typeof parsed.password === "string" &&
      parsed.username &&
      parsed.password
    ) {
      return { username: parsed.username, password: parsed.password };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setStoredCredential(host: string, cred: GitCredential): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CRED_PREFIX + host, JSON.stringify(cred));
  } catch {
    /* ignore */
  }
}

export function clearStoredCredential(host: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CRED_PREFIX + host);
  } catch {
    /* ignore */
  }
}

export function clearAllStoredCredentials(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CRED_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function getAppCorsProxy(): string {
  if (typeof window === "undefined") return DEFAULT_CORS_PROXY;
  try {
    const v = localStorage.getItem(CORS_KEY);
    if (v === null) return DEFAULT_CORS_PROXY;
    return v.trim();
  } catch {
    return DEFAULT_CORS_PROXY;
  }
}

export function setAppCorsProxy(proxy: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CORS_KEY, proxy.trim());
  } catch {
    /* ignore */
  }
}
