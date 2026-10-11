// src/components/ui/Card.tsx
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds a neon glow accent on hover */
  hover?: boolean;
  /** Accent color for the glow (CSS color string) */
  accentColor?: string;
  as?: "div" | "article" | "section";
}

export function Card({
  children,
  className,
  hover = false,
  accentColor,
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={cn(
        "glass-card rounded-xl border border-white/5 p-5",
        hover && "transition-all duration-200 hover:-translate-y-0.5",
        className
      )}
      style={
        hover && accentColor
          ? ({
              "--hover-shadow": `0 4px 24px ${accentColor}20`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  accentColor?: string;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  accentColor,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-4", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: accentColor ? `${accentColor}15` : "rgba(255,255,255,0.05)",
              border: `1px solid ${accentColor ? `${accentColor}30` : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-3">{action}</div>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  unit,
  icon,
  accentColor = "#00f5ff",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className="flex items-baseline gap-1 mt-1.5">
            <p
              className="text-2xl font-bold font-mono tracking-tight"
              style={{ color: accentColor }}
            >
              {value}
            </p>
            {unit && (
              <span className="text-xs text-muted-foreground font-medium">{unit}</span>
            )}
          </div>
          {change !== undefined && (
            <p
              className={cn(
                "text-xs font-semibold mt-1",
                change > 0 ? "text-red-400" : "text-emerald-400"
              )}
            >
              {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `${accentColor}15`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
