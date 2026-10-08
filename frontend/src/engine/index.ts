import { browserRpcUrl, CONTRACTS, STELLAR } from "@/lib/stellar/config";
import { registerAspMembership } from "@/lib/stellar/register";
import type { NoteRow, OnStatus, Prepared, SubmitFn } from "./types";
import { submitPreparedSorobanTx } from "./vendor/stellar.js";
import { deriveKeysFromWallet } from "./vendor/wallet.js";
import { getHandle, initializeWasm } from "./vendor/wasm-facade.js";

export type { OnStatus, StatusUpdate } from "./types";

declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
  }
}

const XLM_DECIMALS = 7;

export function xlmToStroops(amount: string): bigint {
  const trimmed = amount.trim();
  // Strict decimal form only: rejects "", "abc", scientific notation ("1e3"),
  // and malformed multi-dot input before BigInt can throw an opaque error.
  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    throw new Error("Enter a valid amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const padded = `${frac}${"0".repeat(XLM_DECIMALS)}`.slice(0, XLM_DECIMALS);
  const stroops =
    BigInt(whole || "0") * 10n ** BigInt(XLM_DECIMALS) + BigInt(padded || "0");
  if (stroops <= 0n) throw new Error("Amount must be greater than zero");
  return stroops;
}

function noteToStroops(amount: NoteRow["amount"]): bigint {
  if (amount == null) return 0n;
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? BigInt(Math.trunc(amount)) : 0n;
  }
  const text = String(amount).trim();
  if (/^\d+$/.test(text)) return BigInt(text);
  const parsed = Number(text);
  return Number.isFinite(parsed) ? BigInt(Math.trunc(parsed)) : 0n;
}

export function stroopsToXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const value = negative ? -stroops : stroops;
  const whole = value / 10n ** BigInt(XLM_DECIMALS);
  const frac = (value % 10n ** BigInt(XLM_DECIMALS))
    .toString()
    .padStart(XLM_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export async function getShieldedBalance(address: string): Promise<bigint> {
  await initEngine();
  try {
    const notes = await getHandle().webClient.getUserNotes(address, 1000);
    if (!Array.isArray(notes)) return 0n;
    let total = 0n;
    for (const note of notes as NoteRow[]) {
      if (!note?.spent) total += noteToStroops(note.amount);
    }
    return total;
  } catch {
    return 0n;
  }
}

function makeSubmitFn(address: string, onStatus?: OnStatus): SubmitFn {
  return (proved: Prepared) =>
    submitPreparedSorobanTx(
      proved.sorobanTx,
      {
        address,
        rpcUrl: browserRpcUrl(),
        networkPassphrase: STELLAR.networkPassphrase,
      },
      { onStatus },
    );
}

// Public address of the app-provided relayer (safe to expose). The matching
// secret lives only in RELAYER_SECRET, used server-side by /api/relay.
const RELAYER_ADDRESS = process.env.NEXT_PUBLIC_RELAYER_ADDRESS?.trim() ?? "";

export function relayerConfigured(): boolean {
  return RELAYER_ADDRESS.length > 0;
}

// Submits the proven tx through the server-side relayer instead of the wallet,
// so the note owner never signs and never appears as the on-chain source.
function makeRelaySubmitFn(onStatus?: OnStatus): SubmitFn {
  return async (proved: Prepared) => {
    onStatus?.({ stage: "submit", message: "Submitting via relayer..." });
    const res = await fetch("/api/relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        txXdr: proved.sorobanTx.txXdr,
        authEntries: proved.sorobanTx.authEntries,
        latestLedger: proved.sorobanTx.latestLedger ?? 0,
      }),
    });
    let data: { hash?: string; error?: string } = {};
    try {
      data = (await res.json()) as { hash?: string; error?: string };
    } catch {
      // non-JSON error body
    }
    if (!res.ok || !data.hash) {
      throw new Error(data.error || `Relayer failed (HTTP ${res.status})`);
    }
    onStatus?.({ stage: "confirm", message: "Confirmed via relayer." });
    return data.hash;
  };
}

async function wipeOpfs(): Promise<void> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : null;
  if (!storage?.getDirectory) return;
  const root = await storage.getDirectory();
  const names: string[] = [];
  for await (const name of root.keys()) names.push(name);
  await Promise.all(
    names.map((name) =>
      root.removeEntry(name, { recursive: true }).catch(() => undefined),
    ),
  );
}

function clearAspFlags(): void {
  if (typeof window === "undefined") return;
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("zStellar:asp-registered:")) {
      window.localStorage.removeItem(key);
    }
  }
}

let storageChecked = false;
async function maybeResetStorage(): Promise<void> {
  if (storageChecked || typeof window === "undefined") return;
  storageChecked = true;
  const key = "zStellar:engine-pool";
  if (window.localStorage.getItem(key) === CONTRACTS.pool) return;
  await wipeOpfs();
  clearAspFlags();
  window.localStorage.setItem(key, CONTRACTS.pool);
}

async function initEngine() {
  await maybeResetStorage();
  return initializeWasm(browserRpcUrl());
}

async function ready(address: string, onStatus?: OnStatus) {
  await initEngine();
  await deriveKeysFromWallet(address, {
    onStatus: (message) => onStatus?.({ stage: "keys", message }),
  });
  return getHandle().webClient;
}

export async function shield(
  address: string,
  amount: string,
  onStatus?: OnStatus,
): Promise<string[]> {
  const stroops = xlmToStroops(amount);
  const client = await ready(address, onStatus);
  return client.executeDeposit(
    CONTRACTS.pool,
    address,
    stroops,
    [stroops, 0n],
    makeSubmitFn(address, onStatus),
    onStatus,
  );
}

export async function getMyShieldedAddress(
  address: string,
  onStatus?: OnStatus,
): Promise<string> {
  await initEngine();
  const keys = await deriveKeysFromWallet(address, {
    onStatus: (message) => onStatus?.({ stage: "keys", message }),
  });
  return `${keys.pubKey}:${keys.encryptionKeypair.publicKey}`;
}

async function getAspLeaf(
  address: string,
  onStatus?: OnStatus,
): Promise<string> {
  await initEngine();
  const keys = await deriveKeysFromWallet(address, {
    onStatus: (message) => onStatus?.({ stage: "keys", message }),
  });
  const leaf = await getHandle().webClient.deriveAspUserLeaf(
    BigInt(keys.aspSecret),
    keys.pubKey,
  );
  return typeof leaf === "string" ? leaf : String(leaf);
}

function aspFlagKey(address: string): string {
  return `zStellar:asp-registered:${address}`;
}

function isAspRegistered(address: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(aspFlagKey(address)) !== null;
}

function markAspRegistered(address: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(aspFlagKey(address), "1");
  }
}

async function ensureAspRegistered(
  address: string,
  onStatus?: OnStatus,
): Promise<void> {
  if (isAspRegistered(address)) return;
  onStatus?.({
    stage: "register",
    message: "Registering you in the ASP membership set (one-time)...",
  });
  const leaf = await getAspLeaf(address, onStatus);
  await registerAspMembership(address, leaf);
  markAspRegistered(address);
  onStatus?.({
    stage: "register",
    message: "Registered. Syncing with the chain, then proving...",
  });
  await new Promise((resolve) => setTimeout(resolve, 6000));
}

export async function depositWithAutoRegister(
  address: string,
  amount: string,
  onStatus?: OnStatus,
): Promise<string[]> {
  await ensureAspRegistered(address, onStatus);

  let hashes = await shield(address, amount, onStatus);
  if (Array.isArray(hashes) && hashes.length > 0) return hashes;

  for (let i = 0; i < 15; i++) {
    onStatus?.({
      stage: "sync",
      message: `Waiting for ASP membership to sync from the chain (${i + 1})...`,
    });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    hashes = await shield(address, amount, onStatus);
    if (Array.isArray(hashes) && hashes.length > 0) return hashes;
  }
  return hashes;
}

// When relay is on, the app's relayer becomes the Soroban tx source and the
// `sender` arg of `transact`, and the proven tx is submitted server-side by the
// relayer keypair, so the note owner's address never appears on-chain. Otherwise
// the note owner signs and submits via the wallet as before.
function relaySetup(
  noteOwner: string,
  useRelay: boolean | undefined,
  onStatus?: OnStatus,
): { submitFn: SubmitFn; sender: string } {
  if (useRelay && RELAYER_ADDRESS && RELAYER_ADDRESS !== noteOwner) {
    return { submitFn: makeRelaySubmitFn(onStatus), sender: RELAYER_ADDRESS };
  }
  return { submitFn: makeSubmitFn(noteOwner, onStatus), sender: "" };
}

export async function transfer(
  address: string,
  amount: string,
  recipientNoteKey: string,
  recipientEncKey: string,
  onStatus?: OnStatus,
  useRelay?: boolean,
): Promise<string[]> {
  const stroops = xlmToStroops(amount);
  const client = await ready(address, onStatus);
  const { submitFn, sender } = relaySetup(address, useRelay, onStatus);
  return client.executeTransfer(
    CONTRACTS.pool,
    address,
    stroops,
    recipientNoteKey,
    recipientEncKey,
    submitFn,
    onStatus,
    sender,
  );
}

export async function withdraw(
  address: string,
  recipient: string,
  amount: string,
  onStatus?: OnStatus,
  useRelay?: boolean,
): Promise<string[]> {
  const stroops = xlmToStroops(amount);
  const client = await ready(address, onStatus);
  const { submitFn, sender } = relaySetup(address, useRelay, onStatus);
  return client.executeWithdraw(
    CONTRACTS.pool,
    address,
    recipient,
    stroops,
    submitFn,
    onStatus,
    sender,
  );
}
