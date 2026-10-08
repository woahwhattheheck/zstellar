"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import {
  TbAlertTriangle,
  TbCheck,
  TbCircleCheck,
  TbExternalLink,
  TbLoader2,
} from "react-icons/tb";

import { activeStep, STEPS } from "./txSteps";

export type TxPhase = "running" | "success" | "error";

type Props = {
  phase: TxPhase | null;
  title: string;
  stage: string;
  message: string | null;
  txHash: string | null;
  error: string | null;
  onClose: () => void;
};

export function TxModal({
  phase,
  title,
  stage,
  message,
  txHash,
  error,
  onClose,
}: Props) {
  const active = activeStep(stage);
  const currentStep = STEPS[active] || STEPS[0];

  return (
    <AnimatePresence>
      {phase ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={phase === "running" ? undefined : onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md md:max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-purple-500/10 flex flex-col md:flex-row"
          >
            {phase === "running" ? (
              <>
                {/* Left Panel: Preview/Visual Area */}
                <div className="relative w-full md:w-5/12 bg-gradient-to-b from-zinc-900/50 to-zinc-950 p-6 flex flex-col items-center justify-center border-b border-zinc-800 md:border-b-0 md:border-r border-zinc-800 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.08),transparent_70%)]" />

                  {/* Glowing Ring Effect */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-32 h-32 bg-purple-500/10 rounded-full blur-xl animate-pulse" />

                    {/* Rotating Border */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute w-24 h-24 rounded-full border-2 border-dashed border-purple-500/30"
                    />

                    {/* Outer Solid Ring */}
                    <div className="absolute w-28 h-28 rounded-full border border-purple-500/10" />

                    {/* Logo Image */}
                    <div className="relative w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center p-2 border border-zinc-800">
                      <Image
                        src="/Assets/Images/Logo-Brands/zStellar-logo.png"
                        alt="zStellar Logo"
                        width={64}
                        height={64}
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-6 text-center z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                      {currentStep.visualState}
                    </span>
                    <p className="mt-3 text-xs text-zinc-400 max-w-[180px] mx-auto leading-relaxed">
                      {currentStep.description}
                    </p>
                  </div>
                </div>

                {/* Right Panel: Stepper Content */}
                <div className="w-full md:w-7/12 p-6 flex flex-col justify-center">
                  <h2 className="text-lg font-bold text-zinc-100 tracking-wide">
                    {title} Transaction
                  </h2>

                  <div className="relative mt-6 flex flex-col gap-6">
                    {/* Background Connector Line */}
                    <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-zinc-800" />

                    {/* Active Glowing Line */}
                    <motion.div
                      className="absolute left-[11px] top-3 w-[2px] bg-gradient-to-b from-purple-500 via-indigo-500 to-cyan-500"
                      initial={{ height: 0 }}
                      animate={{
                        height:
                          active === 0
                            ? 0
                            : `${(active / (STEPS.length - 1)) * 100}%`,
                      }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      style={{ originY: 0 }}
                    />

                    {STEPS.map((step, index) => {
                      const done = index < active;
                      const current = index === active;
                      return (
                        <div
                          key={step.key}
                          className="relative flex items-start gap-4"
                        >
                          {/* Step Node */}
                          <span
                            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-300 ${
                              done
                                ? "border-purple-500 bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                : current
                                  ? "border-purple-400 bg-zinc-950 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                                  : "border-zinc-800 bg-zinc-950 text-zinc-500"
                            }`}
                          >
                            {done ? (
                              <TbCheck className="h-3.5 w-3.5" />
                            ) : current ? (
                              <TbLoader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              index + 1
                            )}
                          </span>

                          {/* Step details */}
                          <div className="flex min-w-0 flex-col pt-0.5">
                            <span
                              className={`text-sm font-semibold transition-colors duration-300 ${
                                current || done
                                  ? "text-zinc-100"
                                  : "text-zinc-500"
                              }`}
                            >
                              {step.label}
                            </span>
                            {current && message ? (
                              <motion.span
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-1 text-xs text-zinc-400 leading-normal"
                              >
                                {message}
                              </motion.span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : phase === "success" ? (
              <div className="w-full p-8 flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 bg-emerald-500/10 rounded-full blur-xl animate-pulse" />
                  <TbCircleCheck className="h-16 w-16 text-emerald-400 z-10" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-zinc-100 tracking-wide">
                  {title} Complete
                </h2>
                <p className="mt-2 text-sm text-zinc-400 max-w-[260px]">
                  Transaction successfully confirmed on Stellar Testnet.
                </p>
                {txHash ? (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-300 transition-all hover:bg-zinc-900 hover:text-white"
                  >
                    View Explorer <TbExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-8 h-11 w-full max-w-[200px] cursor-pointer rounded-full bg-zinc-100 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="w-full p-8 flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 bg-red-500/10 rounded-full blur-xl animate-pulse" />
                  <TbAlertTriangle className="h-16 w-16 text-red-400 z-10" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-zinc-100 tracking-wide">
                  {title} Failed
                </h2>
                <p className="mt-3 max-w-[280px] max-h-32 overflow-auto text-sm leading-relaxed text-zinc-400">
                  {error ??
                    "Something went wrong during transaction execution."}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-8 h-11 w-full max-w-[200px] cursor-pointer rounded-full bg-red-500/10 border border-red-500/20 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
