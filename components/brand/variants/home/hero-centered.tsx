import Link from "next/link";

import type { HeroContent } from "./types";

/*
 * Hero — centered.
 *
 * Symmetric alternative: eyebrow, headline, lede, and CTA stacked on the
 * centerline. Same content as the editorial variant, arranged gallery-style so
 * the display type leads. Still one accent, still the display serif — within
 * brand, just a quieter posture.
 */

export function HeroCentered({ content }: { content: HeroContent }) {
  return (
    <section className="surface-noise relative px-6 md:px-14 pt-16 md:pt-28 pb-24 md:pb-42">
      <div className="flex flex-col items-center text-center gap-10 md:gap-14">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
          {content.eyebrow}
        </div>
        <h1
          className="font-display leading-[var(--leading-display)] tracking-[-0.02em] max-w-[16ch]"
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
        <p
          className="max-w-2xl text-[color:var(--color-ink-800)]"
          style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
        >
          {content.lede}
        </p>
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
    </section>
  );
}
