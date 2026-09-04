import type {
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function PageContainer({
  className,
  size = "default",
  ...props
}: HTMLAttributes<HTMLElement> & {
  size?: "narrow" | "default" | "wide";
}) {
  return (
    <main
      className={cn(
        size === "narrow" && "ui-page-container-narrow",
        size === "default" && "ui-page-container",
        size === "wide" && "ui-page-container-wide",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  actions,
  breadcrumb,
  className,
  description,
  title,
}: {
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        "ui-page-header sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb ? (
          <div className="mb-2 text-xs text-muted-foreground">{breadcrumb}</div>
        ) : null}
        <h1>{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ui-section", className)} {...props} />;
}

export function Toolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-toolbar", className)} {...props} />;
}

const statusClasses = {
  neutral: "bg-muted text-muted-foreground",
  info: "ui-status-info",
  success: "ui-status-success",
  warning: "ui-status-warning",
  danger: "ui-status-danger",
} as const;

export function StatusBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof statusClasses;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Metric({
  className,
  label,
  note,
  value,
}: {
  className?: string;
  label: ReactNode;
  note?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className={cn("border-l-2 border-primary px-4 py-3", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {note ? (
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

export function FormField({
  children,
  className,
  error,
  hint,
  label,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
}) {
  return (
    <label
      className={cn("grid gap-1.5 text-sm text-foreground", className)}
      {...props}
    >
      <span className="font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-h-48 place-items-center border border-dashed border-border bg-card p-8 text-center",
        className,
      )}
    >
      <div className="max-w-sm">
        {icon ? (
          <div className="mx-auto mb-3 flex justify-center text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {action ? (
          <div className="mt-4 flex justify-center">{action}</div>
        ) : null}
      </div>
    </div>
  );
}

export function InlineAlert({
  children,
  className,
  tone = "info",
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-current/20 px-4 py-3 text-sm",
        statusClasses[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function DialogSurface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-overlay", className)} {...props} />;
}
