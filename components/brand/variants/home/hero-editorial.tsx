import Link from "next/link";

import type { HeroContent } from "./types";

/*
 * Hero — editorial (shipped default).
 *
 * Asymmetric: the display headline overhangs the left column (-mx) and the
 * lede/CTA sit on a 12-column baseline, lede on the left third, CTA pushed to
 * the right. The brand's broken-grid rhythm in its loudest moment.
 */

export function HeroEditorial({ content }: { content: HeroContent }) {
  return (
    <section className="surface-noise relative px-6 md:px-14 pt-16 md:pt-28 pb-24 md:pb-42">
      <div className="flex flex-col gap-10 md:gap-16">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
          {content.eyebrow}
        </div>
        <h1
          className="font-display leading-[var(--leading-display)] tracking-[-0.02em] -mx-1 md:-mx-2"
          style={{
            fontSize: "var(--text-display)",
            fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 0',
            textWrap: "balance",
          }}
        >
          {content.title.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-end">
          <p
            className="md:col-span-5 md:col-start-1 text-[color:var(--color-ink-800)]"
            style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
          >
            {content.lede}
          </p>
          <div className="md:col-span-3 md:col-start-9 flex items-baseline gap-4">
            <Link
              href={content.ctaHref}
              className="group inline-flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
            >
              {content.ctaLabel}
              <span
                aria-hidden
                className="inline-block transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
