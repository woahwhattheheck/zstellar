/**
 * Adapted from Nethermind stellar-private-payments app/js/wasm-facade.js.
 *
 * The wasm-bindgen bundle (web.js + web_bg.wasm + workers) is served as a
 * static asset from /engine and loaded at runtime, so it is not bundled by
 * Next. Everything else (signing, submitting) is bundled normally.
 */

let handle = null;
let mod = null;
let initPromise = null;

// Optional loader permits deterministic single-flight/retry tests without fetching
// the real WASM from /public. Runtime callers use the same dynamic import.
export async function initializeWasm(
  rpcUrl,
  moduleLoader = (url) => import(/* webpackIgnore: true */ /* @vite-ignore */ url),
) {
  if (handle) return handle;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const url = `${window.location.origin}/engine/js/web.js`;
    mod =
      mod ?? (await moduleLoader(url));

    await mod.default();
    const config = new mod.Config(rpcUrl);
    handle = await mod.mainThread(config);
    return handle;
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

export const getHandle = () => {
  if (!handle) {
    throw new Error("WASM not initialized. Call initializeWasm first.");
  }
  return handle;
};
