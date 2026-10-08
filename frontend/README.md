# zStellar frontend

Next.js app for zStellar — the privacy layer for payments on Stellar testnet.
Deposit, pay, and cash out without revealing amounts or the sender → receiver
link. See the [root README](../README.md) for the project overview and
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for deployment.

## Commands

pnpm only — do not use `npm`, `yarn`, or `bun`.

```bash
pnpm install
pnpm dev       # development server on http://localhost:3000
pnpm build     # production build
pnpm start     # serve the production build
pnpm lint      # biome check
pnpm format    # biome format --write
pnpm test      # vitest run
```

## Layout

The app router lives under `src/app`; the main page is
`src/app/(main)/page.tsx`. Notable directories:

- `src/app/(main)/` — landing page and the `/app` experience
- `src/app/api/relay` — server-side relayer for shielded transactions
- `src/app/api/rpc` — Soroban RPC proxy (bounds `startLedger` ranges)
- `src/components/` — landing sections, `pages/(main)` app UI, `ui/` primitives
- `src/engine/` — WASM prover facade, key derivation, shielded-pool actions
- `src/features/wallet/` — Freighter connection state and faucet
- `src/lib/stellar/` — Horizon/Soroban clients and contract addresses
- `src/tests/` — vitest suites (`../` resolves to `src/`; `@/` maps to `src/`
  via `vitest.config.ts`)

## Cross-origin isolation

`next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on every route — the Web Worker
prover needs `SharedArrayBuffer`, which browsers only expose on cross-origin
isolated pages. Because of COEP, every asset the page loads must be same-origin
(see `public/Assets`) or explicitly CORP/CORS-enabled; third-party CDN embeds
will be refused.

## Fonts

Inter and Geist Mono are loaded via `next/font/google` in
`src/app/layout.tsx`.
