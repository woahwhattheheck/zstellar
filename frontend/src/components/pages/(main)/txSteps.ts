// Stepper model for TxModal, extracted so the stage->step mapping is
// unit-testable without pulling the motion/next image chain into Node.
export const STEPS = [
  {
    key: "prepare",
    label: "Preparing keys & membership",
    stages: ["keys", "register", "sync", "sync_wait"],
    description: "Deriving private keys and verifying ASP membership list",
    visualState: "PREPARING KEYS",
  },
  {
    key: "prove",
    label: "Generating ZK proof",
    stages: ["load_state", "prove", "compute", "witness"],
    description:
      "Building Groth16 zk-SNARK proof over BN254 circuit client-side",
    visualState: "GENERATING PROOF",
  },
  {
    key: "sign",
    label: "Sign in wallet",
    stages: ["sign_auth", "sign_tx"],
    description: "Approve transaction authorization signature via Freighter",
    visualState: "WAITING SIGNATURE",
  },
  {
    key: "submit",
    label: "Submitting on-chain",
    stages: ["submit", "confirm"],
    description:
      "Broadcasting verified transaction envelope to Soroban network",
    visualState: "BROADCASTING TX",
  },
] as const;

export function activeStep(stage: string): number {
  const index = STEPS.findIndex((step) =>
    step.stages.some((value) => stage.includes(value)),
  );
  return index === -1 ? 0 : index;
}
