# CLAUDE.md — Salishforge

Project-local guidance for Claude Code sessions. Extends the user-global doctrine in `~/.claude/CLAUDE.md` and the workspace `~/dev/CLAUDE.md`. The full implementation plan lives at `~/.claude/plans/salishforge-is-a-small-jiggly-hamming.md` — read it before any non-trivial change.

## What this is

Salishforge — a custom-products commerce site for a small home business making laser-engraved, UV-printed, and inner-crystal-engraved goods. Single Next.js app covering customer storefront, AI-assisted customizer, checkout, customer accounts, admin, and the print-ready file pipeline. Design bar is "Apple-tier" — the framework is boring substrate; the typography, motion, customizer, and AI-as-collaborator behaviors are where differentiation lives.

## Stack quick reference

| | |
|---|---|
| Framework | Next.js 15.x App Router + React 19, TypeScript strict |
| Styling | Tailwind v4 (CSS-first `@theme` config in `app/globals.css`) |
| Fonts | `next/font/google` — Fraunces (display), Inter Tight (UI), JetBrains Mono. Swap to GT Sectra + Söhne once foundry licensed (one file change in `app/fonts.ts`) |
| Database | PostgreSQL 17 on Neon (Launch plan), Drizzle ORM + `drizzle-kit` |
| Files | Cloudflare R2 via `@aws-sdk/client-s3`, presigned PUT for browser uploads |
| Images CDN | Cloudflare Images |
| Background jobs | Inngest (durable functions, webhook completion) |
| Payments | Stripe Checkout + Payment Element + Stripe Tax |
| Auth | WorkOS AuthKit (`@workos-inc/authkit-nextjs`) |
| Email | Resend + React Email |
| AI | Replicate (Flux family) — server-side only, never client |
| 2D canvas | Konva (`react-konva`) |
| 3D | React Three Fiber + drei (hero SKUs only) |
| Motion | Motion (Framer Motion v12+) |
| Hosting | Vercel Pro (Node runtime everywhere — no edge) |

## Repo layout

```
app/                          # Next.js App Router
  (storefront)/               # Public catalog group
  (account)/                  # Authed customer group
  admin/                      # Admin group (role-gated in middleware)
  api/                        # Route handlers (webhooks, SSE, file uploads)
  customize/[productSlug]/    # The customizer
  layout.tsx, page.tsx, globals.css, fonts.ts
components/
  customizer/                 # Konva stage, layers, AI panel
  brand/                      # Display type components, motion primitives
  ui/                         # shadcn-style primitives (admin-leaning)
drizzle/
  schema.ts                   # Single source of truth for the data model
  migrations/                 # Generated SQL (hand-reviewed before commit)
inngest/
  client.ts
  functions/                  # Durable orchestrators
lib/
  parse/                      # Zod schemas at every external boundary
  design/                     # Motion presets, easing, spacing helpers
  replicate/                  # AI pipeline (server action + Inngest fn)
  r2/                         # Storage SDK + presigner
  stripe/                     # Stripe client + webhook helpers
  auth/                       # WorkOS helpers
emails/                       # React Email templates
public/                       # Static assets (icons, manifest)
```

## Conventions

- **Server-side only** for any service holding an API key (Replicate, Stripe secret, Resend, R2 secrets, WorkOS server SDK).
- **Browser uploads to R2 via presigned PUT** — bytes never round-trip through Next.
- **Parse, don't validate** — every external payload (HTTP body, webhook, R2 metadata, Replicate response) passes through a Zod schema in `lib/parse`. Internal functions skip defensive checks; the type system already excluded the bad cases.
- **Order state is snapshotted** — `orders` and `order_items` carry frozen `product_snapshot` and `customization_snapshot` jsonb. Never read live product data for an existing order.
- **Money in cents** as `int`, always paired with `currency` (char 3).
- **Ids** as `cuid2` text — sortable-ish, URL-safe, no sequence leak.
- **Webhooks idempotent** — every handler writes `(provider, event_id)` into `webhook_events` (UNIQUE) before doing work.
- **One accent color** in the brand palette (`--ember-500`). Adding a second is a brand decision, not a casual change.
- **Motion uses the named presets** in `lib/design/motion.ts` — no ad-hoc transitions.
- **Type ramps and color tokens** live in `app/globals.css` under `@theme`. Override Tailwind defaults; never use the default ramps.
- **Mono** for SKU codes, dimensions, order numbers, prices in production-grade contexts. **Tabular slashed-zero** on prices/quantities — `font-variant-numeric: tabular-nums slashed-zero`.

## When adding a feature

1. **Read the plan first** — `~/.claude/plans/salishforge-is-a-small-jiggly-hamming.md`. Find the section that covers the feature. If the feature isn't covered, propose a plan update before coding.
2. **Schema first** — if it touches data, edit `drizzle/schema.ts`, generate the migration (`pnpm db:generate`), hand-review the SQL, commit schema + migration together.
3. **Parser at the boundary** — add a Zod schema in `lib/parse` for any external input. Wire it in the route/action.
4. **Server action or route handler** — server-side code lives in `app/**/actions.ts` (Server Actions) or `app/api/**/route.ts` (Route Handlers). API tokens never reach the client.
5. **Inngest for long work** — anything that exceeds ~3 seconds, talks to Replicate, generates print files, or sends email goes through an Inngest function. Webhooks call `inngest.send(...)`.
6. **Snapshot at order conversion** — when a cart converts to an order, copy product + customization state into the order row. Do not FK-reference live data.
7. **Gates** — `pnpm typecheck && pnpm lint && pnpm build` before commit. Smoke-test the feature in the browser. Security check the diff.

## Environment

See `.env.example`. Local dev needs:
- A Neon branch (free) for the database
- Inngest dev server (`pnpm inngest:dev` in a second terminal)
- Stripe CLI for webhook forwarding (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
- WorkOS dev application with redirect to `http://localhost:3000/callback`

## Cost guardrails (Replicate)

- Cache-key dedupe on every AI generation (sha256 of normalized prompt + sorted reference hashes + model + params). Same request → $0.
- Per-customer 20–40/day, per-IP 5/day for guests, burst 5/60s.
- Daily aggregate kill switch via `AI_DAILY_COST_CEILING_USD_CENTS` env. Operator emailed on trip.
- Default model is `flux-schnell` (~$0.003/image). Quality upgrades are opt-in with visible price.

## What not to do

- Don't introduce edge runtime — Sharp, pg, Stripe raw-body, Replicate client want Node.
- Don't reach for Prisma — Drizzle is the choice.
- Don't add a CMS — Postgres holds products, MDX in repo holds long-form copy.
- Don't `--no-verify` past a hook failure.
- Don't add a second accent color, a fade-in-on-scroll, or a "Generate with AI ✨" button.
- Don't tell the customer "use a bigger screen" — the customizer works on mobile.
