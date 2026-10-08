"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { TbDroplet, TbX } from "react-icons/tb";
import { useWalletContext } from "./WalletProvider";

export function FaucetButton() {
  const wallet = useWalletContext();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const short = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-6)}`
    : null;

  const claim = async () => {
    if (!wallet.address) {
      setMessage("Connect your wallet first.");
      return;
    }
    setClaiming(true);
    setMessage("Requesting from Friendbot...");
    try {
      const ok = await wallet.fund();
      setMessage(
        ok
          ? "Faucet funded your account. Balance updated."
          : "Funding failed (account may already be funded).",
      );
    } catch {
      setMessage("Funding failed (account may already be funded).");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-fill"
      >
        <TbDroplet className="h-4 w-4" />
        Faucet
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-2xl shadow-[color:var(--shadow)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-fg">
                  <TbDroplet className="h-5 w-5" />
                  Claim Faucet
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer text-muted transition-colors hover:text-fg"
                >
                  <TbX className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted">
                Get free testnet XLM from the Stellar Friendbot to try zStellar.
                No real assets, testnet only.
              </p>

              {short ? (
                <div className="mt-4 rounded-xl border border-line bg-fill px-4 py-3 text-sm text-muted">
                  {short}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-line bg-fill px-4 py-3 text-sm text-faint">
                  Connect your wallet to claim.
                </div>
              )}

              <button
                type="button"
                onClick={claim}
                disabled={claiming || !wallet.address}
                className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-btn text-base font-semibold text-btn-fg transition-colors hover:bg-btn-hover disabled:opacity-60"
              >
                {claiming ? "Claiming..." : "Claim 10,000 XLM"}
              </button>

              {message ? (
                <p className="mt-3 text-center text-xs text-muted">{message}</p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
