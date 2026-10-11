// src/components/ui/EmptyState.tsx
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
  /** Accent color for the icon container */
  accentColor?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  accentColor = "#00f5ff",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}25`,
        }}
      >
        <Icon
          className="w-7 h-7 opacity-70"
          style={{ color: accentColor }}
        />
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>

      {description && (
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <Button
          variant="primary"
          size="sm"
          onClick={action.onClick}
          leftIcon={action.icon}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
