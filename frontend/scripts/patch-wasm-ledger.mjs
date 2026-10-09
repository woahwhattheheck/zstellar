import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "https://soroban-testnet.stellar.org";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WASM_DIR = path.resolve(__dirname, "..", "public", "engine", "js");
const SHARED_LEDGER_FILE = path.resolve(
  __dirname, "..", "src", "lib", "deployment-ledger.json",
);

async function getLatestLedger() {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch latest ledger: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  }
  return data.result.sequence;
}

async function main() {
  console.log("Fetching latest ledger from Stellar Testnet RPC...");
  const latest = await getLatestLedger();
  // Safe buffer: 1000 ledgers (approx 1.4 hours of history)
  const newLedger = latest - 1000;
  // Rewriting WASM bytes requires an equal-width seven-digit replacement.
  if (!Number.isSafeInteger(newLedger) || String(newLedger).length !== 7) {
    throw new Error("Deployment ledger must be a seven-digit integer");
  }
  console.log(`Latest ledger: ${latest}. Target start ledger: ${newLedger}`);

  const files = [
    "web_bg.wasm",
    "prover-worker_bg.wasm",
    "storage-worker_bg.wasm",
  ];

  let patched = 0;
  for (const file of files) {
    const filePath = path.join(WASM_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required WASM file not found: ${filePath}`);
    }

    console.log(`Patching ${file}...`);
    const buf = fs.readFileSync(filePath);
    const contentStr = buf.toString("binary");

    // We search for `"deploymentLedger":XXXXXXX` where XXXXXXX is 7 digits
    const regex = /"deploymentLedger":\d{7}/g;
    const matches = contentStr.match(regex);

    if (!matches) {
      throw new Error(`No seven-digit deploymentLedger found in ${file}`);
    }

    console.log(`Found pattern: ${matches.join(", ")}`);
    const replaced = contentStr.replace(
      regex,
      `"deploymentLedger":${newLedger}`,
    );

    // Safety check: verify length did not change
    if (replaced.length !== contentStr.length) {
      console.error(
        `Error: Length mismatch after patching! Original: ${contentStr.length}, Patched: ${replaced.length}`,
      );
      process.exit(1);
    }

    fs.writeFileSync(filePath, Buffer.from(replaced, "binary"));
    patched += 1;
    console.log(`Successfully patched ${file}`);
  }

  if (patched !== files.length) {
    throw new Error("Not all WASM bundles were updated; shared ledger left unchanged");
  }
  // Only update the shared RPC route value after the patch operation succeeds.
  fs.writeFileSync(
    SHARED_LEDGER_FILE,
    `${JSON.stringify({ ledger: newLedger }, null, 2)}\n`,
  );
  console.log(`Updated shared deployment ledger: ${newLedger}`);

  console.log(
    "\nAll done! Restart your Next.js dev server or refresh the browser.",
  );
}

main().catch((err) => {
  console.error("Patch failed:", err);
  process.exit(1);
});
