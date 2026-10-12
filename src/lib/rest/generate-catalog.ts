import type { GeneratedCatalogArtifacts, RestServiceMapping } from "./types";
import { generatePaarSketch } from "./generate-paar-sketch";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateResourceModelXml(mapping: RestServiceMapping): string {
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

export function generateCatalogJson(mapping: RestServiceMapping): string {
  const resources = mapping.operations.map((op) => ({
    name: op.name,
    path: op.uri,
    operations: [
      {
        type: "invoke",
        method: op.method,
        name: op.name,
      },
    ],
  }));

  const doc = {
    version: "1.0",
    lastModified: new Date().toISOString(),
    services: [
      {
        name: mapping.serviceName,
        address: mapping.basePath,
        useRequest: true,
        resources,
      },
    ],
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

export function generateCatalogArtifacts(
  mapping: RestServiceMapping
): GeneratedCatalogArtifacts {
  return {
    catalogJson: generateCatalogJson(mapping),
    resourceModelXml: generateResourceModelXml(mapping),
    paarSketchMd: generatePaarSketch(mapping),
  };
}
