import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/rpc/route";

const OK_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { events: [], latestLedger: 3400000 },
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function eventsReq(startLedger: number): unknown {
  return {
    jsonrpc: "2.0",
    id: 9,
    method: "getEvents",
    params: { startLedger },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/rpc getEvents startLedger rewrite", () => {
  it("rewrites startLedger below NEW_DEPLOYMENT_LEDGER before forwarding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(eventsReq(3158000)));
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.method).toBe("getEvents");
    expect(sent.params.startLedger).toBe(3337836);
  });

  it("passes startLedger at or above NEW_DEPLOYMENT_LEDGER through unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await POST(post(eventsReq(3400000)));

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.params.startLedger).toBe(3400000);
  });

  it("never rewrites a non-getEvents method", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      post({
        jsonrpc: "2.0",
        id: 2,
        method: "getLedgerEntries",
        params: { startLedger: 1, keys: [] },
      }),
    );

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.method).toBe("getLedgerEntries");
    expect(sent.params.startLedger).toBe(1);
  });

  it("forwards a non-JSON body unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(OK_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const raw = "\x00\x01binary-payload-not-json";
    await POST(post(raw));

    expect(fetchMock.mock.calls[0][1].body).toBe(raw);
  });
});
