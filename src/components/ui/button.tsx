import Link from "next/link";
import { cn } from "@/lib/cn";

const variantClasses = {
  primary:
    "bg-brand text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-brand-light hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35)] active:bg-brand disabled:opacity-40",
  secondary:
    "bg-surface-raised text-foreground border border-border-hairline hover:border-white/40 hover:bg-white/[0.04] disabled:opacity-40",
  ghost: "text-foreground-muted hover:bg-white/[0.05] hover:text-foreground disabled:opacity-40",
  danger: "bg-status-bad-bg text-status-bad hover:brightness-125 hover:shadow-[0_0_0_1px_rgba(251,113,133,0.4)]",
} as const;

// Press feedback + a clear white focus ring on every button.
const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const sizeClasses = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

type CommonProps = {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        BASE,
        "cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}
