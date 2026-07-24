import { cn } from "@/lib/cn";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-foreground-muted",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-border-hairline bg-surface-raised px-3.5 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none transition-colors focus:border-brand-light",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border-hairline bg-surface-raised px-3.5 text-sm text-foreground outline-none transition-colors focus:border-brand-light",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
