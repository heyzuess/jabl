/** Canonical source repository. Hosted copies link here so users can view and modify the program (AGPL-3.0 §13). */
export const SOURCE_REPOSITORY_URL =
  "https://origin.cursor.com/jesse-iberri/jabl";

/** Inlined at build time. Empty for local dev; `/jabl` for the GitHub Pages project site. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-absolute public URL so it works under `basePath`. */
export function publicPath(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${suffix}`;
}
