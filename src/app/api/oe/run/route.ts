import { NextResponse } from "next/server";
import type { OeRunRequest, OeRunResponse } from "@/lib/oe/types";

// With nextConfig.cacheComponents, route segment configs like `dynamic` and
// `runtime` are unsupported. POST + request.json() already run at request time.

const DEFAULT_AGENT = "http://127.0.0.1:43128";

function agentBase(): string {
  return (process.env.OE_AGENT_URL || DEFAULT_AGENT).replace(/\/$/, "");
}

function isValidBody(body: unknown): body is OeRunRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as OeRunRequest;
  return (
    (b.mode === "compile" || b.mode === "run") &&
    typeof b.entry === "string" &&
    !!b.entry &&
    !!b.files &&
    typeof b.files === "object"
  );
}

export async function POST(request: Request) {
  // #region agent log
  fetch("http://127.0.0.1:7730/ingest/0dbb69f1-5d3d-4ec4-9754-973d979c27ce", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "1e518f",
    },
    body: JSON.stringify({
      sessionId: "1e518f",
      runId: "post-fix",
      hypothesisId: "H1",
      location: "src/app/api/oe/run/route.ts:POST",
      message: "OE run route POST entered (no dynamic export)",
      data: { hasDynamicExport: false },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        compileMessages: [],
        error: "Invalid JSON body",
      } satisfies OeRunResponse,
      { status: 400 }
    );
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        compileMessages: [],
        error: "Body must include mode, entry, and files",
      } satisfies OeRunResponse,
      { status: 400 }
    );
  }

  const url = `${agentBase()}/run`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const data = (await res.json()) as OeRunResponse;
    return NextResponse.json(data, {
      status: res.status >= 500 ? res.status : 200,
    });
  } catch (err) {
    const message = (err as Error).message || String(err);
    return NextResponse.json(
      {
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "",
        compileMessages: [],
        error: `OE agent unreachable at ${url}. Start it with \`npm run oe-agent\`. (${message})`,
      } satisfies OeRunResponse,
      { status: 502 }
    );
  }
}
