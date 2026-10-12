import type { RestOperation, RestServiceMapping } from "./types";

/**
 * Best-effort extract of jabl-style REST annotations from ABL source.
 * Forms used in samples:
 *   /* @rest ... *\/
 *   /* @rest detail ... *\/
 */
export function parseRestAnnotations(
  ablSource: string,
  fileHint = "AnnotatedResource"
): Partial<RestServiceMapping> & { operations: RestOperation[] } {
  const operations: RestOperation[] = [];
  let serviceName = "";
  let executionMode = "";

  const blockRe = /\/\*\s*@rest(?:\s+(detail))?\s*([\s\S]*?)\*\//gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(ablSource))) {
    const isDetail = !!m[1];
    const body = m[2];
    const fields: Record<string, string> = {};
    for (const line of body.split(/\r?\n/)) {
      const kv = line.match(/^\s*([A-Za-z]+)\s*=\s*(.+?)\s*$/);
      if (kv) fields[kv[1].toLowerCase()] = kv[2].trim();
    }
    if (!isDetail) {
      if (fields.servicename) serviceName = fields.servicename;
      if (fields.executionmode) executionMode = fields.executionmode;
      continue;
    }
    const name = fields.name || "Operation";
    const method = (fields.method || "GET").toUpperCase();
    const uri = fields.path || fields.uri || "/";
    operations.push({
      name,
      method,
      uri,
      target: fileHint,
      operation: name,
      params: [],
    });
  }

  return {
    serviceName: serviceName || undefined,
    basePath: serviceName ? `/rest/${serviceName}` : undefined,
    operations,
    ...(executionMode ? { version: "1.0.0" } : {}),
  };
}

/** Merge annotation ops into mapping; mapping wins on name conflicts. */
export function mergeAnnotationsIntoMapping(
  mapping: RestServiceMapping,
  annotated: Partial<RestServiceMapping> & { operations: RestOperation[] }
): RestServiceMapping {
  const byName = new Map(mapping.operations.map((o) => [o.name, o]));
  for (const op of annotated.operations) {
    if (!byName.has(op.name)) {
      byName.set(op.name, {
        ...op,
        target: op.target || mapping.operations[0]?.target || "",
      });
    }
  }
  return {
    serviceName: mapping.serviceName || annotated.serviceName || "RestService",
    basePath:
      mapping.basePath ||
      annotated.basePath ||
      `/rest/${mapping.serviceName || "RestService"}`,
    version: mapping.version || annotated.version || "1.0.0",
    operations: [...byName.values()],
  };
}
