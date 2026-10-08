import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the WASM handle and Freighter; deriveKeysFromWallet only reaches
// signMessage (via signWalletMessage with skipEnsureReady) and getHandle().
const webClient = {
  getUserKeys: vi.fn(),
  getASPSecret: vi.fn(),
  deriveAndSaveUserKeys: vi.fn(async () => undefined),
  keyDerivationMessage: vi.fn(() => "derive-keys-message"),
};

vi.mock("../engine/vendor/wasm-facade.js", () => ({
  getHandle: () => ({ webClient }),
}));

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

import { signMessage } from "@stellar/freighter-api";
import { deriveKeysFromWallet } from "../engine/vendor/wallet.js";

const ACCOUNT = "GABC123";
const KEYS = {
  noteKeypair: { public: "NOTE_PUB" },
  encryptionKeypair: { public: "ENC_PUB" },
};
const ASP = { membershipBlinding: "42" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("deriveKeysFromWallet", () => {
  it("returns the cached keys without prompting a signature", async () => {
    webClient.getUserKeys.mockResolvedValue(KEYS);
    webClient.getASPSecret.mockResolvedValue(ASP);

    const res = await deriveKeysFromWallet(ACCOUNT, {});
    expect(res).toEqual({
      pubKey: "NOTE_PUB",
      encryptionKeypair: { publicKey: "ENC_PUB" },
      aspSecret: "42",
    });
    expect(signMessage).not.toHaveBeenCalled();
    expect(webClient.deriveAndSaveUserKeys).not.toHaveBeenCalled();
  });

  it("cold path: signs, decodes base64 into bytes, and persists", async () => {
    // First lookups miss; after derivation both hit.
    webClient.getUserKeys
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(KEYS);
    webClient.getASPSecret
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ASP);
    vi.mocked(signMessage).mockResolvedValue({
      signedMessage: btoa("sig-bytes"),
      signerAddress: ACCOUNT,
    });

    const res = await deriveKeysFromWallet(ACCOUNT, {});
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(webClient.deriveAndSaveUserKeys).toHaveBeenCalledWith(
      ACCOUNT,
      Uint8Array.from(atob("c2lnLWJ5dGVz"), (c) => c.charCodeAt(0)),
    );
    expect(res.pubKey).toBe("NOTE_PUB");
    expect(res.aspSecret).toBe("42");
  });

  it("skipCacheCheck forces re-derivation even when the cache hits", async () => {
    webClient.getUserKeys
      .mockResolvedValueOnce(KEYS)
      .mockResolvedValueOnce(KEYS);
    webClient.getASPSecret
      .mockResolvedValueOnce(ASP)
      .mockResolvedValueOnce(ASP);
    vi.mocked(signMessage).mockResolvedValue({
      signedMessage: btoa("x"),
      signerAddress: ACCOUNT,
    });

    await deriveKeysFromWallet(ACCOUNT, { skipCacheCheck: true });
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it("rethrows a user rejection with the friendly message", async () => {
    webClient.getUserKeys.mockResolvedValue(null);
    webClient.getASPSecret.mockResolvedValue(null);
    vi.mocked(signMessage).mockResolvedValue({
      error: { message: "User rejected this request" },
    });

    await expect(deriveKeysFromWallet(ACCOUNT, {})).rejects.toThrow(
      "Please approve the message signature to derive your privacy keys and ASP secret",
    );
  });
});
