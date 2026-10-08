/**
 * Minimal .env file reader/writer shared by the setup scripts.
 * Extracted from setup-relayer.mjs so the behaviour is unit-testable.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Parse `envPath` into ordered lines plus a KEY -> value map (first wins is
 * not applied; later duplicate keys overwrite in `map` while `lines` keeps the
 * original ordering verbatim). */
export function readEnv(envPath) {
  if (!existsSync(envPath)) return { lines: [], map: {} };
  const text = readFileSync(envPath, "utf8");
  const lines = text.split("\n");
  const map = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return { lines, map };
}

/** Upsert `updates` into `envPath`: existing keys are replaced in place, new
 * keys appended, unrelated lines preserved, and trailing blank lines collapse
 * into a single newline. */
export function writeEnv(envPath, updates) {
  const text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = text.length ? text.split("\n") : [];
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    const entry = `${key}=${value}`;
    if (idx >= 0) lines[idx] = entry;
    else lines.push(entry);
  }
  // collapse trailing blank lines into a single newline
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  writeFileSync(envPath, `${lines.join("\n")}\n`);
}
