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

const styles = {
  primary: "bg-ink text-ivory shadow-soft hover:bg-ink-soft hover:shadow-lift",
  secondary: "border border-ink/25 bg-transparent text-ink hover:border-gold hover:bg-ink/[.03]",
  gold: "btn-shine bg-gold text-ink shadow-soft hover:bg-gold-light hover:shadow-lift",
};

export function Button(props: Props) {
  const { variant = "primary", loading = false, className = "" } = props;

  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 ${styles[variant]} ${className}`;

  if ("href" in props && props.href) {
    // Se separan las props propias del botón para no pasarlas como atributos del <a>.
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { href, children, variant: _v, loading: _l, className: _c, ...linkProps } = props;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return (
      <Link href={href} {...linkProps} className={cls}>
        {loading ? "Cargando…" : children}
      </Link>
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { children, variant: _v, loading: _l, className: _c, ...buttonProps } = props as NativeButtonProps;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <button {...buttonProps} className={cls} disabled={loading || buttonProps.disabled}>
      {loading ? "Cargando…" : children}
    </button>
  );
}
