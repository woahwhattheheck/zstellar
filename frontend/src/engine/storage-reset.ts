import { CONTRACTS } from "../lib/stellar/config";

declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
  }
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

/** Test-only: reset the one-shot guard so a fresh case can re-run. */
export function __resetStorageCheckedForTests(): void {
  storageChecked = false;
}

/**
 * One-shot storage reset when the configured pool contract changes.
 *
 * `localStorage` may be unavailable or throw (private mode, blocked cookies).
 * Failures degrade to "reset skipped" rather than propagating out of the
 * engine's first call.
 */
export async function maybeResetStorage(): Promise<void> {
  if (storageChecked || typeof window === "undefined") return;
  storageChecked = true;
  const key = "zStellar:engine-pool";
  try {
    if (window.localStorage.getItem(key) === CONTRACTS.pool) return;
    await wipeOpfs();
    clearAspFlags();
    window.localStorage.setItem(key, CONTRACTS.pool);
  } catch {
    // Storage unavailable — reset skipped.
  }
}
