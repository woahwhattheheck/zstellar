import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTRACTS } from "../lib/stellar/config";
import {
  __resetStorageCheckedForTests,
  maybeResetStorage,
} from "../engine/storage-reset";

function stubStorage(localStorage: object) {
  vi.stubGlobal("window", { localStorage });
  vi.stubGlobal("navigator", { storage: undefined });
}

afterEach(() => {
  __resetStorageCheckedForTests();
  vi.unstubAllGlobals();
});

describe("maybeResetStorage", () => {
  it("resolves without throwing when localStorage.getItem throws", async () => {
    stubStorage({
      getItem() {
        throw new Error("denied");
      },
    });
    await expect(maybeResetStorage()).resolves.toBeUndefined();
  });

  it("resolves without throwing when localStorage.setItem throws", async () => {
    stubStorage({
      getItem: () => null,
      setItem() {
        throw new Error("denied");
      },
      get length() {
        return 0;
      },
      key: () => null,
      removeItem: () => undefined,
    });
    await expect(maybeResetStorage()).resolves.toBeUndefined();
  });

  it("does nothing when the stored pool already matches", async () => {
    const setItem = vi.fn();
    stubStorage({
      getItem: () => CONTRACTS.pool,
      setItem,
      get length() {
        return 0;
      },
      key: () => null,
      removeItem: () => undefined,
    });
    await maybeResetStorage();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("is skipped when window is unavailable", async () => {
    vi.stubGlobal("window", undefined);
    await expect(maybeResetStorage()).resolves.toBeUndefined();
  });
});
