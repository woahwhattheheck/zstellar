import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/rpc/route";

const RANGE_ERROR = JSON.stringify({
  jsonrpc: "2.0",
  id: 7,
  error: {
    code: -32603,
    message: "startLedger must be within the ledger range: 3158900 - 3200100",
  },
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function eventsReq(params: Record<string, unknown>): unknown {
  return { jsonrpc: "2.0", id: 7, method: "getEvents", params };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/rpc startLedger out-of-range interception", () => {
  it("synthesises a 200 empty-events page and echoes the request cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(RANGE_ERROR, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      post(eventsReq({ pagination: { cursor: "CURSOR-X" } })),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(7);
    expect(body.result.events).toEqual([]);
    expect(body.result.cursor).toBe("CURSOR-X");
    expect(body.result.latestLedger).toBe(3200100);
    expect(body.result.oldestLedger).toBe(3158900);
    expect(body.result.oldestLedgerCloseTime).toBe("1782052423");
  });

  it("fabricates the cursor from startLedger when none is supplied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(RANGE_ERROR, { status: 200 })),
    );

    const res = await POST(post(eventsReq({ startLedger: 3337836 })));
    const body = await res.json();
    expect(body.result.cursor).toBe("0000000000003337836-0000000000");
  });

  it("falls back to rangeNewest when neither cursor nor startLedger is present", async () => {
    // Note: an out-of-range response is only possible after the request passed
    // the pre-rewrite guard, so this covers the residual fallback path.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(RANGE_ERROR, { status: 200 })),
    );

    const res = await POST(post(eventsReq({ startLedger: null })));
    const body = await res.json();
    expect(body.result.cursor).toBe("0000000000003200100-0000000000");
  });

  it("passes a non-matching upstream error through unchanged", async () => {
    const otherError = JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32602, message: "some other RPC failure" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(otherError, { status: 200 })),
    );

    const res = await POST(post(eventsReq({ startLedger: 3400000 })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error.message).toBe("some other RPC failure");
    expect(body.result).toBeUndefined();
  });
});
