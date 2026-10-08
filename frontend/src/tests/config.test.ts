import { afterEach, describe, expect, it, vi } from "vitest";
import { Address, Networks } from "@stellar/stellar-sdk";

import { browserRpcUrl, CONTRACTS, STELLAR } from "../lib/stellar/config";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserRpcUrl", () => {
  it("returns the same-origin /api/rpc proxy in a browser", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://app.example" },
    });
    expect(browserRpcUrl()).toBe("https://app.example/api/rpc");
  });

  it("returns the direct RPC URL when window is absent (server)", () => {
    vi.stubGlobal("window", undefined);
    expect(browserRpcUrl()).toBe(STELLAR.rpcUrl);
    expect(browserRpcUrl()).not.toContain("/api/rpc");
  });
});

describe("STELLAR", () => {
  it("targets testnet", () => {
    expect(STELLAR.network).toBe("testnet");
    expect(STELLAR.networkPassphrase).toBe(Networks.TESTNET);
  });
});

describe("CONTRACTS", () => {
  it("defines exactly the six deployed ids", () => {
    expect(Object.keys(CONTRACTS).sort()).toEqual([
      "aspMembership",
      "aspNonMembership",
      "deployer",
      "pool",
      "token",
      "verifier",
    ]);
  });

  it.each(Object.entries(CONTRACTS))(
    "%s is a non-empty valid Stellar StrKey",
    (_name, value) => {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      // Address.fromString validates the underlying StrKey checksum for both
      // contract (C...) and account (G...) ids.
      expect(() => Address.fromString(value)).not.toThrow();
    },
  );
});
