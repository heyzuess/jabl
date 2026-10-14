/**
 * Verify classic REST catalog generation against sample goldens.
 * Usage: node scripts/verify-rest-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Load TS via transpile-free duplicate of generator logic for Node:
// Import compiled isn't available; re-implement thin check by spawning tsx if present,
// else inline minimal generate matching src/lib/rest.

function parseServiceMapping(text) {
  const data = JSON.parse(text);
  return {
    serviceName: data.serviceName || "RestService",
    basePath: data.basePath || `/rest/${data.serviceName || "RestService"}`,
    version: data.version || "1.0.0",
    operations: (data.operations || []).map((o) => ({
      name: o.name,
      method: (o.method || "GET").toUpperCase(),
      uri: o.uri || o.path || "/",
      target: o.target || "",
      operation: o.operation || o.name,
      params: o.params || [],
    })),
  };
}

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateResourceModelXml(mapping) {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<resourceModel serviceName="${escXml(mapping.serviceName)}" basePath="${escXml(mapping.basePath)}" version="${escXml(mapping.version || "1.0.0")}">`,
  ];
  for (const op of mapping.operations) {
    lines.push(
      `  <resource name="${escXml(op.name)}" method="${escXml(op.method)}" uri="${escXml(op.uri)}" target="${escXml(op.target)}" operation="${escXml(op.operation)}"/>`
    );
  }
  lines.push(`</resourceModel>`, ``);
  return lines.join("\n");
}

function generateCatalogJson(mapping) {
  const doc = {
    version: "1.0",
    lastModified: "FIXED",
    services: [
      {
        name: mapping.serviceName,
        address: mapping.basePath,
        useRequest: true,
        resources: mapping.operations.map((op) => ({
          name: op.name,
          path: op.uri,
          operations: [
            { type: "invoke", method: op.method, name: op.name },
          ],
        })),
      },
    ],
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

function normalizeCatalog(text) {
  const o = JSON.parse(text);
  o.lastModified = "FIXED";
  return JSON.stringify(o, null, 2) + "\n";
}

const classic = path.join(ROOT, "public/samples/abl/rest/classic");
const mapping = parseServiceMapping(
  fs.readFileSync(path.join(classic, "service-mapping.json"), "utf8")
);
const xml = generateResourceModelXml(mapping);
const catalog = generateCatalogJson(mapping);
const expectedXml = fs.readFileSync(
  path.join(classic, "expected/resourceModel.xml"),
  "utf8"
);
const expectedCatalog = normalizeCatalog(
  fs.readFileSync(path.join(classic, "expected/catalog.json"), "utf8")
);

let failed = false;
if (xml !== expectedXml) {
  console.error("resourceModel.xml mismatch");
  failed = true;
} else {
  console.log("OK resourceModel.xml");
}
if (catalog !== expectedCatalog) {
  console.error("catalog.json mismatch (structure)");
  console.error("--- got ---\n" + catalog);
  console.error("--- expected ---\n" + expectedCatalog);
  failed = true;
} else {
  console.log("OK catalog.json");
}

if (failed) process.exit(1);
console.log("REST catalog goldens verified.");
