import type { OeMode, OeRunRequest, OeRunResponse } from "./types";

const agentBase = process.env.NEXT_PUBLIC_OE_AGENT_URL?.replace(/\/$/, "");

function oeRunUrl(): string {
  return agentBase ? `${agentBase}/run` : "/api/oe/run";
}

function unreachableError(): string {
  if (agentBase) {
    return `OE agent unreachable at ${agentBase}. Start it with \`npm run oe-agent\` on this computer.`;
  }
  return "OE agent unreachable. Start it with `npm run oe-agent` (default http://127.0.0.1:43128).";
}

export async function compileOrRun(
  mode: OeMode,
  request: Omit<OeRunRequest, "mode">,
  init?: { signal?: AbortSignal }
): Promise<OeRunResponse> {
  const body: OeRunRequest = { mode, ...request };

  let res: Response;
  try {
    res = await fetch(oeRunUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: init?.signal,
    });
  } catch (err) {
    const aborted =
      (err as Error)?.name === "AbortError" ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError");
    return {
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "",
      compileMessages: [],
      error: aborted ? "Request cancelled" : unreachableError(),
    };
  }

  let data: OeRunResponse;
  try {
    data = (await res.json()) as OeRunResponse;
  } catch {
    return {
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "",
      compileMessages: [],
      error: agentBase
        ? `Invalid response from OE agent (HTTP ${res.status})`
        : `Invalid response from OE proxy (HTTP ${res.status})`,
    };
  }

  if (!res.ok && !data.error) {
    return {
      ...data,
      ok: false,
      error:
        data.error ||
        (res.status === 502 ? unreachableError() : `OE request failed (HTTP ${res.status})`),
    };
  }

  return data;
}
