import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/rpc/route";

const RANGE_ERROR_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32600,
    message:
      "startLedger must be within the ledger range: 1000 - 2000",
  },
});

function rpcRequest(payload: unknown): Request {
  return new Request("https://zstellar.example/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function stubUpstream(body: string, status = 400) {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(body, {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/rpc out-of-range interception", () => {
  it("does not swallow the error for non-getEvents methods", async () => {
    stubUpstream(RANGE_ERROR_BODY);
    const res = await POST(
      rpcRequest({
        jsonrpc: "2.0",
        id: 7,
        method: "getTransaction",
        params: { hash: "abc" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error?.code).toBe(-32600);
  });

  it("synthesizes an empty page when the requested position is past the newest ledger", async () => {
    stubUpstream(RANGE_ERROR_BODY);
    const res = await POST(
      rpcRequest({
        jsonrpc: "2.0",
        id: 8,
        method: "getEvents",
        params: { startLedger: 4000000 },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: {
        events: unknown[];
        cursor: string;
        latestLedger: number;
        oldestLedgerCloseTime?: string;
      };
    };
    expect(body.result.events).toEqual([]);
    expect(body.result.latestLedger).toBe(2000);
    // No hardcoded fake close time may be emitted.
    expect(body.result.oldestLedgerCloseTime).not.toBe("1782052423");
  });

  it("propagates the upstream error when the cursor is still inside the range", async () => {
    stubUpstream(RANGE_ERROR_BODY);
    const res = await POST(
      rpcRequest({
        jsonrpc: "2.0",
        id: 9,
        method: "getEvents",
        params: {
          pagination: { cursor: "0000000000000001500-0000000000" },
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error?.code).toBe(-32600);
  });
});
