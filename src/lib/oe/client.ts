import type { OeMode, OeRunRequest, OeRunResponse } from "./types";

export async function compileOrRun(
  mode: OeMode,
  request: Omit<OeRunRequest, "mode">,
  init?: { signal?: AbortSignal }
): Promise<OeRunResponse> {
  const body: OeRunRequest = { mode, ...request };

  let res: Response;
  try {
    res = await fetch("/api/oe/run", {
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
      error: aborted
        ? "Request cancelled"
        : "OE agent unreachable. Start it with `npm run oe-agent` (default http://127.0.0.1:43128).",
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
      error: `Invalid response from OE proxy (HTTP ${res.status})`,
    };
  }

  if (!res.ok && !data.error) {
    return {
      ...data,
      ok: false,
      error:
        data.error ||
        (res.status === 502
          ? "OE agent unreachable. Start it with `npm run oe-agent`."
          : `OE request failed (HTTP ${res.status})`),
    };
  }

  return data;
}
