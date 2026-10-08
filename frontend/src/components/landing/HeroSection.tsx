"use client";

import Image from "next/image";
import Link from "next/link";
import { TbArrowRight, TbShieldLock } from "react-icons/tb";
import { VideoBackground } from "@/components/ui/VideoBackground";
import { useSmoothScroll } from "./SmoothScroll";

const PROVES = ["Groth16", "BN254", "Poseidon2", "Soroban"];

export function HeroSection() {
  const { scrollTo } = useSmoothScroll();

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-20 text-center">
      <VideoBackground fixed={false} />
      <div className="pointer-events-none absolute inset-0 z-0 bg-prism-veil" />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted backdrop-blur-sm">
          <TbShieldLock className="h-3.5 w-3.5 text-emerald-400" />
          Shielded payments on Stellar · Testnet
        </span>

        <h1 className="text-5xl font-medium leading-[1.05] tracking-tight text-fg sm:text-6xl md:text-7xl">
          Pay on Stellar with the
          <br />
          amount and the link
          <br />
          <span className="italic">invisible.</span>
        </h1>

        <p className="max-w-xl text-base leading-7 text-muted">
          zStellar shields a public asset into a pool, moves value privately
          between users, and withdraws back to any address — without revealing
          amounts or the sender&nbsp;→&nbsp;receiver link on-chain. Proofs are
          generated in your browser; a relayer submits, so your address never
          appears.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="flex h-12 cursor-pointer items-center gap-1.5 rounded-full bg-btn pr-5 pl-6 text-[15px] font-semibold text-btn-fg transition-colors hover:bg-btn-hover"
          >
            Launch app
            <TbArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => scrollTo("#how")}
            className="flex h-12 cursor-pointer items-center rounded-full border border-line bg-surface px-6 text-[15px] font-medium text-fg backdrop-blur-sm transition-colors hover:bg-fill"
          >
            See how it works
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Image
              src="/Assets/Images/Logo-Brands/zStellar-logo.png"
              alt=""
              aria-hidden="true"
              width={14}
              height={14}
              loading="lazy"
              decoding="async"
              className="h-3.5 w-3.5 rounded object-contain"
            />
            Proven with
          </span>
          {PROVES.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-fg backdrop-blur-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
