import { signTransaction } from "@stellar/freighter-api";
import {
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { server } from "./client";
import { CONTRACTS, STELLAR } from "./config";

// `BigInt` already accepts both decimal and `0x`-prefixed leaf text, so no
// prefix branching is needed here.
export function leafToU256ScVal(leaf: string) {
  const text = leaf.trim();
  const value = BigInt(text);
  return nativeToScVal(value, { type: "u256" });
}

export async function registerAspMembership(
  address: string,
  leaf: string,
): Promise<string> {
  const account = await server.getAccount(address);
  const contract = new Contract(CONTRACTS.aspMembership);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.networkPassphrase,
  })
    .addOperation(contract.call("insert_leaf", leafToU256ScVal(leaf)))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`ASP register simulation failed: ${sim.error}`);
  }
  const prepared = rpc.assembleTransaction(built, sim).build();

  const { signedTxXdr, error } = await signTransaction(prepared.toXDR(), {
    address,
    networkPassphrase: STELLAR.networkPassphrase,
  });
  if (error || !signedTxXdr) {
    throw new Error(
      typeof error === "string" ? error : "ASP register rejected",
    );
  }

  const sent = await server.sendTransaction(
    new Transaction(signedTxXdr, STELLAR.networkPassphrase),
  );
  if (!sent.hash) throw new Error("ASP register submission failed");

  let result = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && result.status === "NOT_FOUND"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await server.getTransaction(sent.hash);
  }
  if (result.status !== "SUCCESS") {
    throw new Error(`ASP register failed (${result.status})`);
  }
  return sent.hash;
}
