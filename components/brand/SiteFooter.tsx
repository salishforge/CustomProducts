/*
 * Footer — single mono line above a hairline. Shop-floor terse.
 */

export function SiteFooter() {
  return (
    <footer className="px-6 md:px-14 mt-32 pb-12">
      <div className="hairline hairline-t pt-8 flex flex-col gap-4 md:flex-row md:items-baseline md:justify-between font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)]">
        <span>Salishforge · Made in the Pacific Northwest</span>
        <span className="nums-tabular">© 2026</span>
      </div>
    </footer>
  );
}
