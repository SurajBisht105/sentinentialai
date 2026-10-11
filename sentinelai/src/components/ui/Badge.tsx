// src/components/ui/Badge.tsx
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "success"
  | "warning"
  | "running"
  | "queued"
  | "failed";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:   "bg-white/5 border-white/10 text-muted-foreground",
  critical:  "bg-red-500/10 border-red-500/30 text-red-400",
  high:      "bg-orange-500/10 border-orange-500/30 text-orange-400",
  medium:    "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  low:       "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  info:      "bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan",
  success:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  warning:   "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  running:   "bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan",
  queued:    "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  failed:    "bg-red-500/10 border-red-500/30 text-red-400",
};

const dotColors: Record<BadgeVariant, string> = {
  default:  "bg-muted-foreground",
  critical: "bg-red-400",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-emerald-400",
  info:     "bg-cyber-cyan",
  success:  "bg-emerald-400",
  warning:  "bg-yellow-400",
  running:  "bg-cyber-cyan",
  queued:   "bg-yellow-400",
  failed:   "bg-red-400",
};

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            dotColors[variant],
            variant === "running" && "animate-pulse"
          )}
        />
      )}
      {children}
    </span>
  );
}
