import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  /* config options here */
  ...(staticExport ? { output: "export" as const } : {}),
  ...(staticExport
    ? {
        env: {
          NEXT_PUBLIC_OE_AGENT_URL:
            process.env.NEXT_PUBLIC_OE_AGENT_URL ||
            "http://127.0.0.1:43128",
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
