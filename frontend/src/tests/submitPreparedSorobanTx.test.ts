import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the wallet boundary and the RPC Server; keep the real xdr/Transaction
// classes so envelope parsing and fixture building use real XDR.
vi.mock("../engine/vendor/wallet.js", () => ({
  signWalletAuthEntry: vi.fn(),
  signWalletTransaction: vi.fn(),
}));

const sendTransaction = vi.fn();
const getTransaction = vi.fn();
const getLatestLedger = vi.fn();

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...mod,
    rpc: {
      ...mod.rpc,
      Server: vi.fn().mockImplementation(() => ({
        sendTransaction,
        getTransaction,
        getLatestLedger,
      })),
    },
  };
});

import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { signWalletTransaction } from "../engine/vendor/wallet.js";
import { submitPreparedSorobanTx } from "../engine/vendor/stellar.js";

const PASSPHRASE = "Test SDF Network ; September 2015";

function realTxXdr(): string {
  const kp = Keypair.random();
  const account = new Account(kp.publicKey(), "1");
  return new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: kp.publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    )
    .setTimeout(30)
    .build()
    .toXDR();
}

const prepared = () => ({ txXdr: realTxXdr(), authEntries: [], latestLedger: 1 });
const ctx = {
  address: Keypair.random().publicKey(),
  rpcUrl: "https://rpc.invalid",
  networkPassphrase: PASSPHRASE,
};

beforeEach(() => {
  vi.mocked(signWalletTransaction).mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
    signerAddress: ctx.address,
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("submitPreparedSorobanTx confirmation polling", () => {
  it("returns the hash when the first poll reports SUCCESS", async () => {
    sendTransaction.mockResolvedValue({ hash: "h1", status: "PENDING" });
    getTransaction.mockResolvedValue({ status: "SUCCESS" });

    vi.useFakeTimers();
    const p = submitPreparedSorobanTx(prepared(), ctx);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBe("h1");
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(getTransaction).toHaveBeenCalledWith("h1");
  });

  it("throws with the resultXdr when the transaction FAILED", async () => {
    sendTransaction.mockResolvedValue({ hash: "h2", status: "PENDING" });
    getTransaction.mockResolvedValue({ status: "FAILED", resultXdr: "AAAAB3Jlcw==" });

    vi.useFakeTimers();
    const p = submitPreparedSorobanTx(prepared(), ctx);
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).rejects.toThrow(
      "Transaction failed (resultXdr: AAAAB3Jlcw==)",
    );
  });

  it("throws the timeout error after 30 unconfirmed polls", async () => {
    sendTransaction.mockResolvedValue({ hash: "h3", status: "PENDING" });
    getTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    vi.useFakeTimers();
    const p = submitPreparedSorobanTx(prepared(), ctx);
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(40_000);
    await expect(p).rejects.toThrow(
      "Transaction confirmation timed out after 30s (hash: h3)",
    );
    expect(getTransaction).toHaveBeenCalledTimes(30);
  });

  it("throws when sendTransaction returns no hash", async () => {
    sendTransaction.mockResolvedValue({ status: "ERROR" });

    await expect(submitPreparedSorobanTx(prepared(), ctx)).rejects.toThrow(
      "Transaction submission failed",
    );
    expect(getTransaction).not.toHaveBeenCalled();
  });
});
