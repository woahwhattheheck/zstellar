import { describe, expect, it } from "vitest";

import { patchLedgerContent } from "../../scripts/ledger-patch.mjs";

const LEDGER_7DIGIT = '"deploymentLedger":1234567';

function expectPatched(input: string, ledger: number) {
  const result = patchLedgerContent(input, ledger);
  if (!result.matched) throw new Error("expected a match");
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.content;
}

describe("patchLedgerContent", () => {
  it("replaces a 7-digit ledger in place", () => {
    const input = `aa${LEDGER_7DIGIT}bb`;
    expect(expectPatched(input, 7654321)).toBe(
      `aa"deploymentLedger":7654321bb`,
    );
  });

  it("replaces every occurrence", () => {
    const input = `${LEDGER_7DIGIT}|${LEDGER_7DIGIT}`;
    expect(expectPatched(input, 1111111)).toBe(
      '"deploymentLedger":1111111|"deploymentLedger":1111111',
    );
  });

  it("reports no-match when the pattern is absent", () => {
    // 8-digit ledger — the pattern is intentionally fixed at 7 digits and
    // must not silently rewrite other shapes.
    expect(patchLedgerContent('"deploymentLedger":12345678', 7654321)).toEqual(
      { matched: false },
    );
    expect(patchLedgerContent("nothing here", 7654321)).toEqual({
      matched: false,
    });
  });

  it("flags the length guard when the replacement changes byte length", () => {
    // A 6-digit replacement shortens the field; the guard must report it so
    // the caller can exit non-zero rather than corrupt the wasm binary.
    const input = `x${LEDGER_7DIGIT}y`;
    const result = patchLedgerContent(input, 999999);
    expect(result).toMatchObject({
      matched: true,
      ok: false,
      reason: "length-mismatch",
      originalLength: input.length,
      patchedLength: 'x"deploymentLedger":999999y'.length,
    });
  });
});
