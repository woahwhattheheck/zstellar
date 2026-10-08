import { describe, expect, it } from "vitest";
import { pollUntilChanged } from "../lib/pollUntilChanged";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("pollUntilChanged", () => {
  it("applies each reading and stops early once the value changes", async () => {
    const values = [5n, 5n, 7n, 9n];
    const applied: bigint[] = [];
    let calls = 0;
    await pollUntilChanged(
      async () => values[Math.min(calls++, values.length - 1)],
      (v) => applied.push(v),
      { delayMs: 1 },
    );
    expect(calls).toBe(3);
    expect(applied).toEqual([5n, 5n, 7n]);
  });

  it("stops after abort and makes no further read calls", async () => {
    const controller = new AbortController();
    let calls = 0;
    const applied: number[] = [];
    const run = pollUntilChanged(
      async () => {
        calls += 1;
        return calls;
      },
      (v) => applied.push(v),
      { attempts: 10, delayMs: 5, signal: controller.signal },
    );
    await sleep(8);
    controller.abort();
    await run;
    const callsAtAbort = calls;
    await sleep(30);
    expect(calls).toBe(callsAtAbort);
    expect(callsAtAbort).toBeLessThanOrEqual(3);
  });

  it("caps at attempts when the value never changes", async () => {
    let calls = 0;
    const applied: number[] = [];
    await pollUntilChanged(
      async () => ++calls && 42,
      (v) => applied.push(v),
      { attempts: 4, delayMs: 1 },
    );
    expect(calls).toBe(4);
    expect(applied).toEqual([42, 42, 42, 42]);
  });

  it("does nothing when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await pollUntilChanged(
      async () => ++calls,
      () => {},
      { attempts: 3, delayMs: 1, signal: controller.signal },
    );
    expect(calls).toBe(0);
  });
});
