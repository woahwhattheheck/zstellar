import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/rpc/route";

const OK_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { status: "healthy" },
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      body ?? { jsonrpc: "2.0", id: 3, method: "getHealth" },
    ),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/rpc retry and error shaping", () => {
  it("retries a 429 then succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(OK_BODY, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(undefined));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(OK_BODY));
  });

  it("retries a non-JSON upstream body and returns it only when it becomes valid", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>cloudflare</html>", { status: 200 }))
      .mockResolvedValueOnce(new Response(OK_BODY, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(undefined));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(OK_BODY));
  });

  it("returns a 502 JSON-RPC error with the last error after retries exhaust", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("socket hangup"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(undefined));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "socket hangup" },
    });
  });

  it("reports the last retryable HTTP status when retries exhaust", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(undefined));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe(-32603);
    expect(body.error.message).toBe("upstream HTTP 503");
  });

  it("does not retry a successful non-retryable status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(OK_BODY, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(undefined));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(404);
  });
});
