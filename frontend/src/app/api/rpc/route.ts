// Use Edge Runtime: no cold starts, globally distributed, instant response.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.STELLAR_RPC_UPSTREAM ?? "https://soroban-testnet.stellar.org";

// New contracts were deployed at this ledger. Any getEvents request with
// startLedger before this is for a pruned or non-existent range, so we
// rewrite it to start from our actual deployment point. This is needed
// because the WASM binary has the old deployment ledger hardcoded.
const NEW_DEPLOYMENT_LEDGER = 3337836;

const CORS_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

// Soroban RPC cursors open with the ledger sequence as a zero-padded
// decimal segment before the first dash.
function cursorLedger(cursor: unknown): number | null {
  if (typeof cursor !== "string") return null;
  const head = cursor.split("-")[0];
  if (!/^\d{1,19}$/.test(head)) return null;
  const n = Number(head);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request): Promise<Response> {
  let body = await request.text();

  // Parse the request once: the getEvents startLedger rewrite and the
  // out-of-range interception both need the method, id, cursor and
  // startLedger.
  type JsonRpcRequest = {
    method?: string;
    id?: string | number | null;
    params?: {
      startLedger?: number;
      pagination?: { cursor?: string };
    };
  };
  let reqJson: JsonRpcRequest | null = null;
  try {
    reqJson = JSON.parse(body) as JsonRpcRequest;
  } catch {
    // Not JSON — pass through unchanged
  }
  const reqMethod = reqJson?.method;
  const reqId = reqJson?.id ?? null;
  const reqCursor = reqJson?.params?.pagination?.cursor;
  let reqStartLedger = reqJson?.params?.startLedger;

  // Rewrite getEvents requests that start before our new deployment ledger.
  // The WASM binary has the old deployment ledger (~3158xxx) hardcoded; those
  // ledgers are pruned on testnet. We transparently rewrite to the new
  // deployment start so the WASM gets a valid, real RPC response.
  if (
    reqJson?.params &&
    reqMethod === "getEvents" &&
    reqStartLedger != null &&
    Number(reqStartLedger) < NEW_DEPLOYMENT_LEDGER
  ) {
    console.log(
      `[RPC Proxy] Rewriting startLedger ${reqStartLedger} → ${NEW_DEPLOYMENT_LEDGER}`,
    );
    reqJson.params.startLedger = NEW_DEPLOYMENT_LEDGER;
    reqStartLedger = NEW_DEPLOYMENT_LEDGER;
    body = JSON.stringify(reqJson);
  }

  let lastError = "upstream unreachable";
  const startTime = Date.now();
  const maxBudgetMs = 25000; // 25 seconds total budget to align with client-side & Edge limits

  for (let attempt = 0; attempt < 2; attempt++) {
    const elapsed = Date.now() - startTime;
    const remainingMs = maxBudgetMs - elapsed;
    if (remainingMs <= 1000) {
      break; // No time left for another attempt
    }

    let upstream: Response;
    try {
      const ac = new AbortController();
      // Use the remaining budget as the timeout for this fetch
      const t = setTimeout(() => ac.abort(), remainingMs);
      try {
        upstream = await fetch(UPSTREAM, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: ac.signal,
        });
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // If it aborted due to timeout, don't sleep, just continue (it will break anyway if remaining time is small)
      if (lastError.includes("aborted") || lastError.includes("timeout")) {
        continue;
      }
      await delay(300);
      continue;
    }

    // If upstream returns rate limit or temporary server issues, we can try to retry
    if (
      upstream.status === 429 ||
      upstream.status === 502 ||
      upstream.status === 503
    ) {
      lastError = `upstream HTTP ${upstream.status}`;
      await delay(300);
      continue;
    }

    const text = await upstream.text();

    // Check if the response is not valid JSON (e.g. Cloudflare HTML / XDR binary error)
    if (!looksLikeJson(text)) {
      lastError = "upstream returned non-JSON body";
      await delay(300);
      continue;
    }

    // Intercept the "startLedger must be within the ledger range" error only
    // for getEvents requests, and only when the requested page position is past
    // the newest ledger upstream knows about — the client cannot advance, so
    // it gets a synthesized empty page. Any other occurrence of the error
    // (non-getEvents method, or a page position that is still inside the
    // reported range) propagates the upstream error unchanged instead of
    // masking it.
    // This resolves a bug in the precompiled WASM client where start_ledger is
    // not updated inside the pagination page loop, causing it to fall behind
    // the cursor and fail to trigger RpcAhead.
    if (reqMethod === "getEvents") {
      let isOutOfRangeError = false;
      let rangeOldest = 0;
      let rangeNewest = 0;
      try {
        const resJson = JSON.parse(text);
        const errMsg = resJson?.error?.message;
        if (errMsg?.includes("startLedger must be within the ledger range:")) {
          const match = errMsg.match(/range:\s*(\d+)\s*-\s*(\d+)/);
          if (match) {
            isOutOfRangeError = true;
            rangeOldest = Number(match[1]);
            rangeNewest = Number(match[2]);
          }
        }
      } catch {
        // ignore JSON parse error
      }

      if (isOutOfRangeError) {
        const startLedgerNum = Number(reqStartLedger);
        const reqLedger =
          cursorLedger(reqCursor) ??
          (Number.isFinite(startLedgerNum) ? startLedgerNum : 0);
        if (reqLedger > rangeNewest) {
          // If client didn't supply a cursor, generate one from the
          // startLedger or rangeNewest
          const finalCursor =
            reqCursor ||
            `${String(reqStartLedger || rangeNewest).padStart(19, "0")}-0000000000`;

          console.log(
            `[RPC Proxy] Intercepting startLedger out-of-range error. Returning empty events page at ledger ${rangeNewest} with cursor ${finalCursor}`,
          );

          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: reqId,
              result: {
                events: [],
                cursor: finalCursor,
                latestLedger: rangeNewest,
                oldestLedger: rangeOldest,
                latestLedgerCloseTime: String(Math.floor(Date.now() / 1000)),
              },
            }),
            { status: 200, headers: CORS_HEADERS },
          );
        }
        // The requested position is still inside the reported range, so the
        // request can be advanced — propagate the upstream error unchanged.
      }
    }

    // Check for transient RPC errors inside response JSON
    if (text.includes("Please try again") || text.includes("rate limit")) {
      lastError = `stellar RPC transient error (attempt ${attempt + 1})`;
      await delay(300);
      continue;
    }

    return new Response(text, {
      status: upstream.status,
      headers: CORS_HEADERS,
    });
  }

  console.error(`[RPC Proxy] Failed: ${lastError}`);
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: lastError },
    }),
    { status: 502, headers: CORS_HEADERS },
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeJson(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}
