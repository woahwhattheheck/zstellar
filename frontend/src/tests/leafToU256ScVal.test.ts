import { describe, expect, it, vi } from "vitest";
import { scValToNative } from "@stellar/stellar-sdk";

// register.ts imports the browser Freighter API; stub it so the unit test
// evaluates cleanly under the Node runner.
vi.mock("@stellar/freighter-api", () => ({ signTransaction: vi.fn() }));

import { leafToU256ScVal } from "../lib/stellar/register";

describe("leafToU256ScVal", () => {
  it("encodes a decimal leaf as u256", () => {
    const scVal = leafToU256ScVal("42");
    expect(scVal.switch().name).toBe("scvU256");
    expect(scValToNative(scVal)).toBe(42n);
  });

  it("encodes a 0x-prefixed leaf identically to its decimal form", () => {
    const decimal = leafToU256ScVal("255");
    const hex = leafToU256ScVal("0xff");
    expect(scValToNative(hex)).toBe(255n);
    expect(hex.toXDR("base64")).toBe(decimal.toXDR("base64"));
  });

  it("trims surrounding whitespace", () => {
    expect(scValToNative(leafToU256ScVal("  17  "))).toBe(17n);
  });
});
