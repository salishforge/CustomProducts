import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

/*
 * 404 — brand voice version.
 *
 * Per the plan §2.9 differentiation thesis: single mono line, terse, funny
 * only on second read. No illustrations; the workshop is small.
 */

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-32 pb-20 min-h-[60dvh]">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
          404 · no piece here
        </p>
        <h1
          className="mt-4 font-display text-5xl md:text-7xl leading-[1.05] -mx-1"
          style={{
            fontVariationSettings: '"opsz" 120, "wght" 380',
            textWrap: "balance",
          }}
        >
          Nothing&rsquo;s here.
          <br />
          The shop is small.
        </h1>
        <div className="mt-10 flex gap-3">
          <Link
            href="/products"
            className="inline-flex items-center px-5 py-3 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
          >
            See the catalog
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-5 py-3 hairline font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-800)] hover:text-[color:var(--color-ink-950)] transition-colors"
          >
            Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
