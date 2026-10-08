#!/usr/bin/env node
/**
 * One-time relayer setup for zStellar.
 *
 * Creates (or reuses) a dedicated Stellar testnet account that submits private
 * withdraw/transfer transactions on the user's behalf, so the note owner's
 * address never appears on-chain. The secret is written to `.env.local` as a
 * SERVER-ONLY variable (no NEXT_PUBLIC prefix) and is read exclusively by the
 * `/api/relay` route. The public address is exposed to the browser so it can be
 * set as the Soroban tx source.
 *
 * Usage:  node scripts/setup-relayer.mjs
 *
 * Safe to run repeatedly: an existing relayer is reused and just topped up.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { readEnv, writeEnv } from "./env-file.mjs";

const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.local");


async function fundIfNeeded(server, address) {
  try {
    const account = await server.loadAccount(address);
    const xlm = account.balances.find((b) => b.asset_type === "native");
    if (xlm && Number(xlm.balance) > 1) {
      return `already funded (${Number(xlm.balance).toFixed(2)} XLM)`;
    }
  } catch {
    // account does not exist yet -> fall through to friendbot
  }
  const res = await fetch(`${FRIENDBOT}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot failed: HTTP ${res.status}`);
  }
  // 400 usually means "account already funded" which is fine
  const account = await server.loadAccount(address);
  const xlm = account.balances.find((b) => b.asset_type === "native");
  return `funded (${xlm ? Number(xlm.balance).toFixed(2) : "?"} XLM)`;
}

async function main() {
  const { map } = readEnv(envPath);
  let keypair;
  if (map.RELAYER_SECRET) {
    keypair = Keypair.fromSecret(map.RELAYER_SECRET);
    console.log(`Reusing existing relayer: ${keypair.publicKey()}`);
  } else {
    keypair = Keypair.random();
    console.log(`Generated new relayer: ${keypair.publicKey()}`);
  }

  writeEnv(envPath, {
    RELAYER_SECRET: keypair.secret(),
    NEXT_PUBLIC_RELAYER_ADDRESS: keypair.publicKey(),
  });
  console.log(
    "Wrote RELAYER_SECRET + NEXT_PUBLIC_RELAYER_ADDRESS to .env.local",
  );

  const server = new Horizon.Server(HORIZON);
  try {
    const status = await fundIfNeeded(server, keypair.publicKey());
    console.log(`Relayer ${status}`);
  } catch (err) {
    console.warn(
      `Could not fund automatically (${err instanceof Error ? err.message : err}).`,
    );
    console.warn(
      `Fund it manually:\n  ${FRIENDBOT}/?addr=${keypair.publicKey()}`,
    );
  }

  console.log("\nDone. Restart `pnpm dev` so the new env vars load.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
