/**
 * Pure in-memory `"deploymentLedger":NNNNNNN` rewriter for the engine WASM
 * binaries. Extracted from patch-wasm-ledger.mjs so the match / no-match /
 * length-guard branches are unit-testable.
 */

export const DEPLOYMENT_LEDGER_PATTERN = /"deploymentLedger":\d{7}/g;

/**
 * @param {string|Buffer} content  wasm file contents (as the caller would read
 *   it — the caller decides the byte encoding).
 * @param {number} newLedger
 * @returns {{ matched: false } |
 *   { matched: true, ok: true, content: string, found: string[] } |
 *   { matched: true, ok: false, reason: "length-mismatch",
 *     originalLength: number, patchedLength: number }}
 */
export function patchLedgerContent(content, newLedger) {
  const text = typeof content === "string" ? content : content.toString("binary");
  const found = text.match(DEPLOYMENT_LEDGER_PATTERN);
  if (!found) return { matched: false };
  const replaced = text.replace(
    DEPLOYMENT_LEDGER_PATTERN,
    `"deploymentLedger":${newLedger}`,
  );
  if (replaced.length !== text.length) {
    return {
      matched: true,
      ok: false,
      reason: "length-mismatch",
      originalLength: text.length,
      patchedLength: replaced.length,
    };
  }
  return { matched: true, ok: true, content: replaced, found };
}
