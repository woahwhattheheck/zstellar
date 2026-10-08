import { Address, xdr } from "@stellar/stellar-sdk";

/**
 * Whether an authorization entry still needs a signature from `address`:
 * address credentials carrying a void (unsigned) signature. Shared by the
 * browser submit path and the /api/relay route so the check cannot diverge.
 */
export function entryNeedsSigner(entry, address) {
  const creds = entry.credentials();
  if (
    creds.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()
  ) {
    return false;
  }
  const addrAuth = creds.address();
  if (addrAuth.signature().switch().name !== "scvVoid") {
    return false;
  }
  return Address.fromScAddress(addrAuth.address()).toString() === address;
}

/**
 * Attach signed authorization entries to the transaction's first
 * invokeHostFunction operation and return the patched envelope XDR.
 */
export function patchAuthEntries(txXdr, signedAuthEntries) {
  const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
  const v1 = env.v1();
  if (!v1) {
    throw new Error("Unsupported transaction envelope (expected v1)");
  }

  const auth = signedAuthEntries.map((e) =>
    xdr.SorobanAuthorizationEntry.fromXDR(e, "base64"),
  );
  for (const op of v1.tx().operations()) {
    const invoke = op.body()?.invokeHostFunctionOp?.();
    if (!invoke) continue;
    invoke.auth(auth);
    return env.toXDR("base64");
  }

  throw new Error(
    "No invokeHostFunction operation found to attach auth entries",
  );
}
