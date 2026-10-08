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

// Same-origin callers need no CORS grants; omitting ACAO denies every
// cross-origin read while the app keeps working unchanged.
const CORS_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<Response> {
  let body = await request.text();

  // Rewrite getEvents requests that start before our new deployment ledger.
  // The WASM binary has the old deployment ledger (~3158xxx) hardcoded; those
  // ledgers are pruned on testnet. We transparently rewrite to the new
  // deployment start so the WASM gets a valid, real RPC response.
  try {
    const json = JSON.parse(body);
    if (
      json?.method === "getEvents" &&
      json?.params?.startLedger != null &&
      Number(json.params.startLedger) < NEW_DEPLOYMENT_LEDGER
    ) {
      console.log(
        `[RPC Proxy] Rewriting startLedger ${json.params.startLedger} → ${NEW_DEPLOYMENT_LEDGER}`,
      );
      json.params.startLedger = NEW_DEPLOYMENT_LEDGER;
      body = JSON.stringify(json);
    }
  } catch {
    // Not JSON — pass through unchanged
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

    // Intercept "startLedger must be within the ledger range" error and return empty events page.
    // This resolves a bug in the precompiled WASM client where start_ledger is not updated
    // inside the pagination page loop, causing it to fall behind the cursor and fail to trigger RpcAhead.
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
      let reqId = null;
      let reqCursor = null;
      let reqStartLedger = null;
      try {
        const reqJson = JSON.parse(body);
        reqId = reqJson?.id;
        reqCursor = reqJson?.params?.pagination?.cursor;
        reqStartLedger = reqJson?.params?.startLedger;
      } catch {
        // ignore
      }

      // If client didn't supply a cursor, generate one from the startLedger or rangeNewest
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
            oldestLedgerCloseTime: "1782052423",
          },
        }),
        { status: 200, headers: CORS_HEADERS },
      );
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
