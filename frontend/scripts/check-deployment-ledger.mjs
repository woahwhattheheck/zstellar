import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard against drift between the /api/rpc startLedger rewrite and the value
// patched into the WASM bundles by scripts/patch-wasm-ledger.mjs.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(__dirname, "..");

const routeSrc = fs.readFileSync(
  path.join(frontend, "src", "app", "api", "rpc", "route.ts"),
  "utf8",
);
const routeMatch = routeSrc.match(/NEW_DEPLOYMENT_LEDGER\s*=\s*(\d+)/);
if (!routeMatch) {
  console.error(
    "NEW_DEPLOYMENT_LEDGER literal not found in src/app/api/rpc/route.ts",
  );
  process.exit(1);
}
const routeLedger = routeMatch[1];

const wasmFiles = [
  "web_bg.wasm",
  "prover-worker_bg.wasm",
  "storage-worker_bg.wasm",
];

let failed = false;
for (const file of wasmFiles) {
  const wasmPath = path.join(frontend, "public", "engine", "js", file);
  if (!fs.existsSync(wasmPath)) {
    console.warn(`Skipping missing bundle: ${file}`);
    continue;
  }
  const wasm = fs.readFileSync(wasmPath).toString("binary");
  const matches = [...wasm.matchAll(/"deploymentLedger":(\d{7})/g)].map(
    (m) => m[1],
  );
  if (matches.length === 0) {
    console.error(`No "deploymentLedger" pattern found in ${file}`);
    failed = true;
    continue;
  }
  for (const embedded of matches) {
    if (embedded !== routeLedger) {
      console.error(
        `Drift: ${file} has deploymentLedger ${embedded} but ` +
          `NEW_DEPLOYMENT_LEDGER is ${routeLedger}. ` +
          "Run scripts/patch-wasm-ledger.mjs and update the route constant.",
      );
      failed = true;
    }
  }
  if (!failed) {
    console.log(
      `${file}: deploymentLedger ${matches[0]} matches route.ts`,
    );
  }
}

process.exit(failed ? 1 : 0);
