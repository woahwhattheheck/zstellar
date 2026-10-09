import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetStorageCheckedForTests,
  maybeResetStorage,
} from "./storage-reset";

vi.mock("../lib/stellar/config", () => ({
  CONTRACTS: { pool: "TEST_POOL_V2" },
}));

describe("maybeResetStorage pool redeploy guard", () => {
  let entries: Map<string, string>;
  let localStorage: {
    readonly length: number;
    key: (index: number) => string | null;
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let removeEntry: ReturnType<typeof vi.fn>;
  let getDirectory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetStorageCheckedForTests();
    entries = new Map<string, string>();
    localStorage = {
      get length() {
        return entries.size;
      },
      key(index: number) {
        return [...entries.keys()][index] ?? null;
      },
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        entries.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        entries.delete(key);
      }),
    };

    removeEntry = vi.fn(async (_name: string, _options: { recursive: boolean }) => {});
    const root = {
      async *keys() {
        yield "notes";
        yield "nested";
      },
      removeEntry,
    };
    getDirectory = vi.fn(async () => root);
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("navigator", { storage: { getDirectory } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves OPFS and ASP flags when the pool ID matches", async () => {
    entries.set("zStellar:engine-pool", "TEST_POOL_V2");
    entries.set("zStellar:asp-registered:alice", "true");

    await maybeResetStorage();

    expect(getDirectory).not.toHaveBeenCalled();
    expect(removeEntry).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(entries.get("zStellar:asp-registered:alice")).toBe("true");
  });

  it("wipes all OPFS children, clears only ASP flags and advances the stored pool ID", async () => {
    entries.set("zStellar:engine-pool", "OLD_POOL");
    entries.set("zStellar:asp-registered:alice", "true");
    entries.set("unrelated-wallet-preference", "keep");
    entries.set("zStellar:asp-registered:bob", "true");

    await maybeResetStorage();

    expect(getDirectory).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledTimes(2);
    expect(removeEntry).toHaveBeenCalledWith("notes", { recursive: true });
    expect(removeEntry).toHaveBeenCalledWith("nested", { recursive: true });
    expect(entries.has("zStellar:asp-registered:alice")).toBe(false);
    expect(entries.has("zStellar:asp-registered:bob")).toBe(false);
    expect(entries.get("unrelated-wallet-preference")).toBe("keep");
    expect(entries.get("zStellar:engine-pool")).toBe("TEST_POOL_V2");
    expect(localStorage.removeItem).toHaveBeenCalledTimes(2);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "zStellar:engine-pool",
      "TEST_POOL_V2",
    );
  });

  it("checks storage only once per module load", async () => {
    entries.set("zStellar:engine-pool", "OLD_POOL");
    await maybeResetStorage();
    expect(getDirectory).toHaveBeenCalledOnce();

    // A second invocation must not rerun OPFS enumeration or mutate newer keys.
    entries.set("zStellar:engine-pool", "STALE_AGAIN");
    entries.set("zStellar:asp-registered:late", "true");
    await maybeResetStorage();

    expect(getDirectory).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledTimes(2);
    expect(entries.get("zStellar:engine-pool")).toBe("STALE_AGAIN");
    expect(entries.get("zStellar:asp-registered:late")).toBe("true");
  });
});
