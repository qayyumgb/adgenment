"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons (guide §4). One primary per view (top right of the page header).
 *  primary   — brand fill, 40h
 *  secondary — outlined, 40h (36 in toolbars: size "toolbar")
 *  soft      — brand-soft, 32h; AI "Apply" and row actions
 *  ghost     — no border; "Not now", "Undo", "Clear filters"
 */
export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
export type ButtonSize = "md" | "toolbar" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_1px_2px_rgba(60,30,180,.3),inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-brand-hover disabled:hover:bg-brand",
  secondary: "border border-line-2 bg-surface text-ink hover:bg-surface-2 focus-visible:border-brand disabled:hover:bg-surface",
  soft: "bg-brand-soft text-brand-ink hover:bg-brand-soft-2 disabled:hover:bg-brand-soft",
  ghost: "bg-transparent font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:hover:bg-transparent",
  danger: "bg-neg text-white hover:bg-neg/90 disabled:hover:bg-neg",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-10 rounded-ctl px-4 text-sm",
  toolbar: "h-9 rounded-ctl px-3.5 text-sm",
  sm: "h-8 rounded-lg px-3 text-[13px]",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size, loading = false, icon, className, children, disabled, type = "button", ...rest },
  ref
) {
  const s = size ?? (variant === "soft" || variant === "ghost" ? "sm" : "md");
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[s], className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Same styles as Button, rendered as a Next.js link. */
export function ButtonLink({
  href,
  variant = "secondary",
  size,
  icon,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const s = size ?? (variant === "soft" || variant === "ghost" ? "sm" : "md");
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[s], "no-underline", className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Square icon-only button (top bar, toolbars). Always pass a `label`. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; size?: 36 | 38 | 32; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ label, size = 36, className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex flex-none items-center justify-center rounded-ctl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:opacity-50",
        size === 32 ? "h-8 w-8" : size === 38 ? "h-[38px] w-[38px]" : "h-9 w-9",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
