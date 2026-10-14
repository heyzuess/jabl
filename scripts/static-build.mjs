/**
 * Static export for GitHub Pages.
 *
 * `output: "export"` cannot include the dev-only POST handler at
 * src/app/api/oe/run, which reads the request body. That route stays in the
 * tree for `next dev` and `npm run build:server`. This script moves it aside
 * for the duration of `next build`, then puts it back.
 */
import { spawn } from "node:child_process";
import { access, rename } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "src/app/api");
const holdDir = path.join(root, ".static-export-api");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function restoreApi() {
  if (await exists(holdDir)) {
    if (await exists(apiDir)) {
      throw new Error(
        `Cannot restore ${apiDir}: both the API route and ${holdDir} exist.`
      );
    }
    await rename(holdDir, apiDir);
  }
}

let moved = false;

async function main() {
  await restoreApi();
  if (!(await exists(apiDir))) {
    throw new Error(`Missing ${apiDir}`);
  }
  await rename(apiDir, holdDir);
  moved = true;

  const code = await new Promise((resolve, reject) => {
    const child = spawn("npx", ["next", "build"], {
      stdio: "inherit",
      env: { ...process.env, STATIC_EXPORT: "1" },
    });
    child.on("error", reject);
    child.on("exit", (status) => resolve(status ?? 1));
  });
  if (code !== 0) process.exitCode = code;
}

try {
  await main();
} finally {
  if (moved) await restoreApi();
}
