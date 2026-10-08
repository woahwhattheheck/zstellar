import { describe, expect, it, vi } from "vitest";
import {
  getXlmBalance,
  horizon,
  XlmBalanceUnavailableError,
} from "../lib/stellar/client";

describe("getXlmBalance", () => {
  it("returns \"0\" for an unfunded account (Horizon 404)", async () => {
    const notFound = Object.assign(new Error("Not Found"), {
      response: { status: 404 },
    });
    vi.spyOn(horizon, "loadAccount").mockRejectedValueOnce(notFound);
    await expect(getXlmBalance("GUNFUNDED")).resolves.toBe("0");
  });

  it("returns the native balance when the account loads", async () => {
    vi.spyOn(horizon, "loadAccount").mockResolvedValueOnce({
      balances: [
        { asset_type: "credit_alphanum4", balance: "7.5" },
        { asset_type: "native", balance: "12.3456789" },
      ],
    } as never);
    await expect(getXlmBalance("GFUNDED")).resolves.toBe("12.3456789");
  });

  it("throws XlmBalanceUnavailableError on a transport failure", async () => {
    vi.spyOn(horizon, "loadAccount").mockRejectedValueOnce(
      new TypeError("fetch failed"),
    );
    await expect(getXlmBalance("GANY")).rejects.toBeInstanceOf(
      XlmBalanceUnavailableError,
    );
  });
});
