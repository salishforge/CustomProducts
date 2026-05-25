import Link from "next/link";

/*
 * Editorial site header.
 *
 * Small mark, generous breathing room, mono-typed nav row. Designed to feel
 * like a magazine masthead, not a SaaS toolbar.
 */

export function SiteHeader() {
  return (
    <header className="px-6 pt-8 pb-6 md:px-14 md:pt-12 md:pb-10">
      <div className="flex items-baseline justify-between gap-6">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight"
          style={{ fontVariationSettings: '"opsz" 24, "wght" 460' }}
        >
          Salishforge
        </Link>
        <nav className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] flex items-center gap-6">
          <Link href="/products" className="hover:text-[color:var(--color-ink-950)] transition-colors">
            Catalog
          </Link>
          <Link href="/about" className="hidden md:inline hover:text-[color:var(--color-ink-950)] transition-colors">
            About
          </Link>
          <Link href="/cart" className="hover:text-[color:var(--color-ink-950)] transition-colors">
            Cart
          </Link>
        </nav>
      </div>
    </header>
  );
}
