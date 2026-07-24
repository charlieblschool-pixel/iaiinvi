import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 108 104"
      className={cn("h-6 w-6", className)}
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="16" y="60" width="16" height="34" rx="8" />
      <circle cx="24" cy="46" r="8" />
      <rect x="46" y="46" width="16" height="48" rx="8" />
      <circle cx="54" cy="32" r="8" />
      <rect x="76" y="32" width="16" height="62" rx="8" />
      <circle cx="84" cy="18" r="8" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("text-brand", markClassName)} />
      <span className="text-lg font-medium tracking-tight text-foreground">
        invii<span className="text-brand-light">.ai</span>
      </span>
    </span>
  );
}
