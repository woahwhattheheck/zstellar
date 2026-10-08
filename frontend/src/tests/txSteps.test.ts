import { describe, expect, it } from "vitest";

import { activeStep, STEPS } from "../components/pages/(main)/txSteps";

// Every stage literal emitted by the engine (engine/index.ts) and the submit
// path (engine/vendor/stellar.js), keyed by the step index it must select.
const EMITTED_STAGES: ReadonlyArray<[string, number]> = [
  ["keys", 0],
  ["register", 0],
  ["sync", 0],
  ["sync_wait", 0],
  ["load_state", 1],
  ["prove", 1],
  ["compute", 1],
  ["witness", 1],
  ["sign_auth", 2],
  ["sign_tx", 2],
  ["submit", 3],
  ["confirm", 3],
];

describe("activeStep", () => {
  it.each(EMITTED_STAGES)("maps emitted stage %j to step %i", (stage, idx) => {
    expect(activeStep(stage)).toBe(idx);
  });

  it("covers every literal declared in STEPS", () => {
    const declared = STEPS.flatMap((step) => [...step.stages]);
    const tested = EMITTED_STAGES.map(([stage]) => stage);
    expect([...tested].sort()).toEqual([...declared].sort());
  });

  it("defaults to step 0 for unknown or empty stages", () => {
    expect(activeStep("")).toBe(0);
    expect(activeStep("totally_unknown")).toBe(0);
  });
});
