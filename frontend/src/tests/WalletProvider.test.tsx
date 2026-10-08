import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// WalletProvider forwards useWallet(); mock it to a stable object so the
// provided case asserts the exact value handed to consumers.
const fakeWallet = {
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "TESTNET",
  balance: "12.5",
  connecting: false,
  error: null,
  connect: vi.fn(() => Promise.resolve()),
  disconnect: vi.fn(),
  fund: vi.fn(() => Promise.resolve("")),
  refresh: vi.fn(() => Promise.resolve()),
};

vi.mock("../features/wallet/useWallet", () => ({
  useWallet: () => fakeWallet,
}));

import {
  useWalletContext,
  WalletProvider,
} from "../features/wallet/WalletProvider";

let captured: ReturnType<typeof useWalletContext> | null = null;
function Probe(): ReactNode {
  captured = useWalletContext();
  return null;
}

describe("useWalletContext", () => {
  it("throws by message when used outside WalletProvider", () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(
      "useWalletContext must be used within a WalletProvider",
    );
  });

  it("returns the wallet value inside the provider", () => {
    renderToStaticMarkup(
      createElement(WalletProvider, null, createElement(Probe)),
    );
    expect(captured).toBe(fakeWallet);
  });
});
