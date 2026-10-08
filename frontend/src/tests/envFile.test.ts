import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEnv, writeEnv } from "../../scripts/env-file.mjs";

let dir: string;
let envPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "envfile-"));
  envPath = join(dir, ".env.local");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readEnv", () => {
  it("returns empty state for a missing file", () => {
    expect(readEnv(envPath)).toEqual({ lines: [], map: {} });
  });

  it("parses KEY=value lines and ignores non-key lines", () => {
    writeFileSync(envPath, "RELAYER_SECRET=SAAA\n# comment\nOTHER=x=y\n");
    const { map } = readEnv(envPath);
    expect(map).toEqual({ RELAYER_SECRET: "SAAA", OTHER: "x=y" });
  });
});

describe("writeEnv", () => {
  it("updates an existing key in place without duplicating it", () => {
    writeFileSync(envPath, "RELAYER_SECRET=OLD\nNEXT_PUBLIC_X=1\n");
    writeEnv(envPath, { RELAYER_SECRET: "NEW" });
    const text = readFileSync(envPath, "utf8");
    expect(text).toBe("RELAYER_SECRET=NEW\nNEXT_PUBLIC_X=1\n");
  });

  it("appends new keys after existing content", () => {
    writeFileSync(envPath, "EXISTING=yes\n");
    writeEnv(envPath, { RELAYER_SECRET: "S123" });
    const text = readFileSync(envPath, "utf8");
    expect(text).toBe("EXISTING=yes\nRELAYER_SECRET=S123\n");
  });

  it("preserves comments and unrelated keys", () => {
    writeFileSync(envPath, "# keep me\nOTHER=42\n");
    writeEnv(envPath, { RELAYER_SECRET: "S9" });
    const text = readFileSync(envPath, "utf8");
    expect(text).toBe("# keep me\nOTHER=42\nRELAYER_SECRET=S9\n");
  });

  it("collapses trailing blank lines into one newline", () => {
    writeFileSync(envPath, "A=1\n\n\n\n");
    writeEnv(envPath, { B: "2" });
    expect(readFileSync(envPath, "utf8")).toBe("A=1\nB=2\n");
  });

  it("creates the file when missing", () => {
    writeEnv(envPath, { RELAYER_SECRET: "S7" });
    expect(readFileSync(envPath, "utf8")).toBe("RELAYER_SECRET=S7\n");
  });
});
