// src/components/ui/Dialog.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Prevent closing by clicking the backdrop */
  disableBackdropClose?: boolean;
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  disableBackdropClose = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={disableBackdropClose ? undefined : onClose}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            ref={dialogRef}
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "relative w-full max-w-lg glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function DialogHeader({ title, subtitle, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-white/5">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close dialog"
        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 p-4 border-t border-white/5 bg-white/2",
        className
      )}
    >
      {children}
    </div>
  );
}
