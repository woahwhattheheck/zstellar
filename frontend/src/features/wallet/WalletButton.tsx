"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { TbChevronDown, TbLogout } from "react-icons/tb";
import { useWalletContext } from "./WalletProvider";

export function WalletButton() {
  const wallet = useWalletContext();
  const [open, setOpen] = useState(false);

  if (!wallet.address) {
    return (
      <button
        type="button"
        onClick={wallet.connect}
        disabled={wallet.connecting}
        className="flex h-10 cursor-pointer items-center rounded-full bg-btn px-5 text-sm font-semibold text-btn-fg transition-colors hover:bg-btn-hover disabled:opacity-70"
      >
        {wallet.connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  const short = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong py-1 pl-1.5 pr-4 text-sm font-medium text-fg transition-colors hover:bg-fill"
      >
        <Image
          src="/Assets/Images/Logo-Brands/zStellar-logo.png"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          className="h-6 w-6 rounded-full object-contain"
        />
        {short}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <TbChevronDown className="h-4 w-4 text-muted" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border border-line bg-panel-2 p-1 shadow-2xl shadow-[color:var(--shadow)]"
          >
            <div className="px-3 py-2 text-xs text-faint">
              Connected on testnet
            </div>
            <button
              type="button"
              onClick={() => {
                wallet.disconnect();
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-fill"
            >
              <TbLogout className="h-4 w-4" />
              Disconnect Wallet
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
