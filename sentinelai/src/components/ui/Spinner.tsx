// src/components/ui/Spinner.tsx
import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  xs: "w-3 h-3 border",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
};

export function Spinner({ size = "md", color = "#00f5ff", className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <span
        className={cn(
          "rounded-full border-t-transparent animate-spin",
          sizeStyles[size]
        )}
        style={{ borderColor: `${color}30`, borderTopColor: "transparent", borderLeftColor: color }}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Full-page centered loading state */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
