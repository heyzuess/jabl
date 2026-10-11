#!/usr/bin/env node
/** Verify docsUrl HTTP status for builtin type catalogs. */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "scrape-builtin-types.mjs"
);

const child = spawn(process.execPath, [script, "--verify"], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
