// src/app/not-found.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-sentinel-900 cyber-grid-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
        <div className="relative mb-8 inline-block">
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <Shield className="w-20 h-20 text-cyber-cyan mx-auto" style={{ filter: "drop-shadow(0 0 20px rgba(0, 245, 255, 0.4))" }} />
          </motion.div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 border-2 border-sentinel-900 flex items-center justify-center">
            <span className="text-xs font-bold text-white">!</span>
          </div>
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-2 font-mono">
          <span className="text-neon-cyan">4</span>0<span className="text-neon-cyan">4</span>
        </h1>
        <p className="text-xl font-semibold text-foreground mb-2">Access Denied / Not Found</p>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          The resource you're looking for doesn't exist or you lack the permissions to access it. This incident has been logged.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-cyber rounded-xl px-6 py-3 font-semibold flex items-center gap-2 text-sm">
            <Home className="w-4 h-4" /> Return to Dashboard
          </Link>
          <button onClick={() => window.history.back()} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground transition-all flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}