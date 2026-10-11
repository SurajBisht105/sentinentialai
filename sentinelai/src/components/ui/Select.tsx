// src/components/ui/Select.tsx
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { forwardRef, SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full appearance-none bg-white/5 border rounded-lg px-4 py-2.5 pr-9 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-cyber-cyan/30",
              error
                ? "border-red-500/50 focus:ring-red-500/30"
                : "border-white/10 focus:border-cyber-cyan/40",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-sentinel-800">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-sentinel-800"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-red-400 flex items-center gap-1">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
