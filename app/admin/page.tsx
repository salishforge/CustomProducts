import Link from "next/link";

/*
 * Admin overview. Quick-link tiles plus an at-a-glance counts strip.
 * Counts are static placeholders until the DB is wired in Phase 2a follow-up.
 */

const QUICK_LINKS = [
  {
    href: "/admin/products/new",
    title: "Add a product",
    blurb: "New SKU with variants, decoration zones, and images.",
  },
  {
    href: "/admin/products",
    title: "Manage catalog",
    blurb: "Edit, archive, or restore existing products.",
  },
  {
    href: "/admin/categories",
    title: "Category metadata",
    blurb: "Display names, blurbs, sort order, visibility.",
  },
  {
    href: "/admin/settings",
    title: "Site settings",
    blurb: "Shipping policy, lead time disclosure, feature flags.",
  },
];

export default function AdminOverview() {
  return (
    <div className="max-w-5xl">
      <header className="mb-12">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Admin
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Workshop.
        </h1>
      </header>

      <section className="mb-14">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Today
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          {[
            { label: "Active products", value: "—" },
            { label: "Drafts", value: "—" },
            { label: "Orders this week", value: "—" },
            { label: "In production", value: "—" },
          ].map((m) => (
            <div
              key={m.label}
              className="border-l border-[color:var(--color-paper-300)] pl-4 py-1"
            >
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                {m.label}
              </p>
              <p className="mt-1 text-2xl nums-tabular text-[color:var(--color-ink-950)]">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Quick actions
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href as never}
                className="group block p-5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] transition-colors"
              >
                <p className="font-display text-lg text-[color:var(--color-ink-950)] group-hover:text-[color:var(--color-ember-700)] transition-colors"
                   style={{ fontVariationSettings: '"opsz" 22, "wght" 460' }}>
                  {link.title}
                </p>
                <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
                  {link.blurb}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
