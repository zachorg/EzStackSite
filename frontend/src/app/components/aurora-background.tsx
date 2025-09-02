"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type AuroraBackgroundProps = {
  className?: string;
};

export function AuroraBackground({ className }: AuroraBackgroundProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden>
      <motion.div
        className="pointer-events-none absolute -inset-[20%] rounded-[9999px]"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 40%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 60%), radial-gradient(50% 40% at 70% 60%, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 60%), radial-gradient(40% 30% at 50% 50%, rgba(244,114,182,0.14) 0%, rgba(244,114,182,0) 60%)",
          filter: "blur(60px)",
        }}
        initial={{ opacity: 0.6, scale: 1 }}
        animate={prefersReduced ? undefined : { opacity: [0.6, 0.9, 0.6], scale: [1, 1.05, 1] }}
        transition={prefersReduced ? undefined : { duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}


