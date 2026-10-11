// src/app/(dashboard)/dashboard/error.tsx
"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex items-center justify-center h-96">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" style={{ filter: "drop-shadow(0 0 10px rgba(255, 51, 102, 0.4))" }} />
        <h2 className="text-lg font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          An unexpected error occurred in this section. The error has been logged to the audit trail.
        </p>
        <button onClick={reset} className="btn-cyber rounded-xl px-6 py-2.5 text-sm font-semibold flex items-center gap-2 mx-auto">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </motion.div>
    </div>
  );
}