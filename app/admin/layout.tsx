import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

/*
 * Admin shell.
 *
 * Two-pane layout: persistent left rail with grouped nav + a main content
 * area. Different visual register from the storefront — admin is the
 * "instrument," not the editorial face. Mono nav, paper-200 sidebar,
 * paper-50 content. Same design tokens though, so a unified look.
 *
 * Auth: requireAdmin redirects to / for non-admin users. The middleware
 * also guards /admin/* paths; the layout call is the second line of
 * defense and what surfaces the current admin's identity in the rail.
 */

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; muted?: boolean }>;
}> = [
  {
    label: "Catalog",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/featured", label: "Featured" },
    ],
  },
  {
    label: "Content",
    items: [{ href: "/admin/settings", label: "Site settings" }],
  },
  {
    label: "Design",
    items: [{ href: "/admin/design", label: "Design Console" }],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/production", label: "Production board" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-dvh grid grid-cols-[260px_1fr]">
      <aside
        className="border-r border-[color:var(--color-paper-300)]/60 bg-[color:var(--color-paper-100)] px-6 py-8 flex flex-col gap-10 sticky top-0 h-dvh overflow-y-auto"
      >
        <Link
          href="/"
          className="font-display text-xl tracking-tight"
          style={{ fontVariationSettings: '"opsz" 22, "wght" 460' }}
        >
          Salishforge
          <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] align-middle">
            admin
          </span>
        </Link>

        <nav className="flex flex-col gap-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] pb-1">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href as never}
                      className={`block py-1.5 text-sm transition-colors ${
                        item.muted
                          ? "text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-600)]"
                          : "text-[color:var(--color-ink-800)] hover:text-[color:var(--color-ink-950)]"
                      }`}
                    >
                      {item.label}
                      {item.muted ? (
                        <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-400)]">
                          soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[color:var(--color-paper-300)]/60">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            Signed in
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-ink-950)] truncate">
            {session.user.email}
          </p>
        </div>
      </aside>

      <main className="px-10 py-10 bg-[color:var(--color-paper-50)]">
        {children}
      </main>
    </div>
  );
}
