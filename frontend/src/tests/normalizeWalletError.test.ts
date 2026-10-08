import { describe, expect, it, vi } from "vitest";

// wallet.js only needs these imports present; the normaliser under test never
// calls them.
vi.mock("@stellar/freighter-api", () => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  setAllowed: vi.fn(),
  signAuthEntry: vi.fn(),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  WatchWalletChanges: vi.fn(),
}));
vi.mock("../engine/vendor/wasm-facade.js", () => ({ getHandle: vi.fn() }));

import { normalizeWalletError } from "../engine/vendor/wallet.js";

describe("normalizeWalletError", () => {
  it.each(["rejected", "declined", "denied", "cancelled"])(
    "marks %s payloads as USER_REJECTED (case-insensitive)",
    (word) => {
      const err = normalizeWalletError(
        { message: `User ${word.toUpperCase()} the request` },
        "fallback",
      );
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe("USER_REJECTED");
      expect(err.message).toContain(word.toUpperCase());
    },
  );

  it("marks an unrelated message as WALLET_ERROR", () => {
    const err = normalizeWalletError(
      { message: "network unreachable" },
      "fallback",
    );
    expect(err.code).toBe("WALLET_ERROR");
    expect(err.message).toBe("network unreachable");
  });

  it("uses the fallback message when error.message is absent", () => {
    const err = normalizeWalletError({}, "Something failed");
    expect(err.message).toBe("Something failed");
    expect(err.code).toBe("WALLET_ERROR");
  });

  it("carries the original payload on err.cause", () => {
    const original = { message: "denied", code: -4 };
    const err = normalizeWalletError(original, "fallback");
    expect(err.cause).toBe(original);
  });
});
