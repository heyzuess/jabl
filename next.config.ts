import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";
// GitHub project Pages serves this repo at /jabl. Set PAGES_BASE_PATH empty for a domain-root site.
const pagesBasePath = process.env.PAGES_BASE_PATH ?? "/jabl";

const nextConfig: NextConfig = {
  /* config options here */
  ...(staticExport ? { output: "export" as const } : {}),
  ...(staticExport && pagesBasePath ? { basePath: pagesBasePath } : {}),
  ...(staticExport
    ? {
        env: {
          NEXT_PUBLIC_OE_AGENT_URL:
            process.env.NEXT_PUBLIC_OE_AGENT_URL ||
            "http://127.0.0.1:43128",
          NEXT_PUBLIC_BASE_PATH: pagesBasePath,
        },
      }
    : {}),
  // Static export cannot use Cache Components: that mode enables PPR, which export rejects.
  // partialPrefetching requires Cache Components, so both stay on for `next dev` only.
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
