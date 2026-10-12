import type { RestOperation, RestParam, RestServiceMapping } from "./types";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function parseParams(raw: unknown): RestParam[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      name: asString(o.name),
      type: asString(o.type) || undefined,
      in:
        o.in === "path" ||
        o.in === "query" ||
        o.in === "body" ||
        o.in === "header"
          ? o.in
          : undefined,
    };
  });
}

function parseOperations(raw: unknown): RestOperation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((op) => {
      const o = (op ?? {}) as Record<string, unknown>;
      return {
        name: asString(o.name),
        method: asString(o.method, "GET").toUpperCase(),
        uri: asString(o.uri || o.path, "/"),
        target: asString(o.target),
        operation: asString(o.operation || o.name),
        params: parseParams(o.params),
      };
    })
    .filter((op) => op.name && op.uri);
}

/** Parse service-mapping.json text into a typed mapping. */
export function parseServiceMapping(text: string): RestServiceMapping {
  const data = JSON.parse(text) as Record<string, unknown>;
  const serviceName = asString(data.serviceName, "RestService");
  const basePath = asString(data.basePath, `/rest/${serviceName}`);
  return {
    serviceName,
    basePath,
    version: asString(data.version, "1.0.0") || "1.0.0",
    operations: parseOperations(data.operations),
  };
}
