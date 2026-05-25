import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
        <h1
          className="font-display text-5xl md:text-6xl leading-[1.05] max-w-3xl"
          style={{
            fontVariationSettings: '"opsz" 96, "wght" 400',
            textWrap: "balance",
          }}
        >
          A small shop in the Pacific Northwest.
        </h1>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14">
          <p
            className="md:col-span-7 md:col-start-1 text-[color:var(--color-ink-800)]"
            style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
          >
            Salishforge makes one piece at a time on a small set of machines:
            a fiber laser, a CO₂ laser, a UV flatbed, and a sub-surface crystal
            engraver. Custom orders are designed with you on the site, then
            cut, engraved, and shipped from a single bench.
          </p>
          <div className="md:col-span-4 md:col-start-9 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular space-y-2">
            <div>Est. 2026</div>
            <div>Pacific Northwest</div>
            <div>1 operator · 4 machines</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
