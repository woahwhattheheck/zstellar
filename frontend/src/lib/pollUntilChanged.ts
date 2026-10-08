export interface PollUntilChangedOptions {
  attempts?: number;
  delayMs?: number;
  signal?: AbortSignal;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollUntilChanged<T>(
  read: () => Promise<T>,
  apply: (value: T) => void,
  options: PollUntilChangedOptions = {},
): Promise<void> {
  const { attempts = 10, delayMs = 3000, signal } = options;
  let first: T | null = null;
  for (let i = 0; i < attempts && !signal?.aborted; i++) {
    const value = await read();
    if (signal?.aborted) return;
    apply(value);
    if (first === null) first = value;
    else if (value !== first) return;
    await delay(delayMs, signal);
  }
}
