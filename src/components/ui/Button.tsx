import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "gold";
  loading?: boolean;
  className?: string;
};

type LinkButtonProps = BaseProps & {
  href: string;
} & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">;

type NativeButtonProps = BaseProps & {
  href?: never;
} & Omit<ComponentProps<"button">, "children" | "className">;

type Props = LinkButtonProps | NativeButtonProps;

export function Button(props: Props) {
  const {
    children,
    variant = "primary",
    loading = false,
    className = "",
  } = props;

  const styles = {
    primary: "bg-ink text-ivory hover:bg-ink-soft",
    secondary:
      "border border-ink/30 bg-transparent text-ink hover:border-gold",
    gold: "bg-gold text-ink hover:bg-gold-light",
  };

  const cls = `inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;

    return (
      <Link href={href} {...linkProps} className={cls}>
        {loading ? "Cargando…" : children}
      </Link>
    );
  }

  const buttonProps = props as NativeButtonProps;

  return (
    <button
      {...buttonProps}
      className={cls}
      disabled={loading || buttonProps.disabled}
    >
      {loading ? "Cargando…" : children}
    </button>
  );
}