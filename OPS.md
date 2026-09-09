# OPS.md — Salishforge operator runbook

Day-to-day procedures for running the store. Stack-level conventions live in
`CLAUDE.md`; the implementation plan lives in
`~/.claude/plans/salishforge-is-a-small-jiggly-hamming.md`.

## Local dev

```bash
pnpm dev                          # Next dev server (Turbopack); default port 3000
pnpm inngest:dev                  # Inngest dev server, in a second terminal
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

To bind dev to the Tailscale interface only:

```bash
pnpm exec next dev --turbo -H 100.97.161.7 -p 3003
```

Sign in to `/admin` requires WorkOS env + the operator email in
`ADMIN_EMAIL_ALLOWLIST`.

## Database

```bash
pnpm db:generate                  # Generate a Drizzle migration after schema edits
pnpm db:migrate                   # Apply pending migrations
pnpm db:seed                      # Idempotent seed: categories + 8 launch products + variants
pnpm db:studio                    # Drizzle Studio web UI
```

Migration SQL is hand-reviewed before commit. `drizzle-kit` auto-loads
`.env.local` via the `process.loadEnvFile` shim in `drizzle.config.ts`.

## Environment matrix

| Var | Required for | Failure mode |
|---|---|---|
| `DATABASE_URL` | Everything | Module-level lazy proxy throws at first query |
| `DATABASE_DIRECT_URL` | Migrations | `pnpm db:migrate` falls back to `DATABASE_URL` |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Admin + account | Middleware throws on first protected request |
| `WORKOS_COOKIE_PASSWORD` (≥32 chars) | Session cookie | Middleware throws at boot |
| `ADMIN_EMAIL_ALLOWLIST` (csv) | `/admin` gate | Authed user → redirected to `/` |
| `STRIPE_SECRET_KEY` | Checkout button | Action throws on click |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verify | Webhook returns 400; orders don't land |
| `REPLICATE_API_TOKEN` | Customizer AI generate | Action throws on click |
| `REPLICATE_WEBHOOK_SECRET` | Generation completion | Webhook returns 400; generations stall |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | All asset storage | `lib/r2` throws on first call naming the missing var |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN` | Image upload | Upload action throws; admin page shows banner |
| `CLOUDFLARE_IMAGES_DELIVERY_DOMAIN` | Image render | URLs fall through to `imagedelivery.net/unset/...` (placeholder tints still show) |
| `RESEND_API_KEY` | Order email | Inngest function returns `ok: false, reason: 'resend_not_configured'`; replay from Inngest UI after configuring |
| `RESEND_FROM_EMAIL` | Order email | Defaults to `orders@salishforge.com` |
| `OPENAI_API_KEY` | Prompt moderation | Fails open in dev with a console warn |
| `AI_DAILY_COST_CEILING_USD_CENTS` | Cost kill switch | Defaults to 2000 (\$20/day) |
| `DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS` | Phase 4 LLM cost cap | Defaults to 200 (\$2/day) |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest production | Local dev server doesn't need these |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error reporting | No-op; logs go to stdout via pino |
| `PRINT_STORAGE_BACKEND` | `r2` to write print files to R2 | Default `fixture` writes to `./print-fixtures/{orderId}/{itemId}/` — removed in G3 |
| `NEXT_PUBLIC_APP_URL` | Stripe redirects, emails, sitemap | Defaults to `http://localhost:3000` (wrong in prod!) |

## Order lifecycle

1. **Customer checks out** → Stripe Checkout session created with `cartId` metadata.
2. **Stripe webhook** `checkout.session.completed` →
   `createOrderFromCheckoutSession`:
   - Resolves or creates a customer row by email.
   - Inserts `orders` with `ON CONFLICT (stripe_payment_intent_id) DO NOTHING`
     (idempotency).
   - Snapshots each cart item into `order_items` (product + variant + design state).
   - Marks the cart `converted`; sends `order.paid` event.
3. **Inngest `sendOrderConfirmation`** consumes `order.paid` → posts an HTML
   email via Resend.
4. **Inngest `fanOutPrintFiles`** consumes `order.paid` → sends one
   `order.print_files_needed` event per order item.
5. **Inngest `generatePrintFiles`** consumes each `order.print_files_needed`
   → resolves the design state, builds SVG/PDF/etc. by family, stores under
   `./print-fixtures/{orderId}/{itemId}/` (or R2 once
   `PRINT_STORAGE_BACKEND=r2`), updates `order_items.print_ready_files` +
   `productionStatus='files_ready'`.

## Production board

`/admin/production` — kanban view across the seven stages
(`pending → files_ready → in_queue → in_production → qc → packed →
shipped`). Click the per-card stage button to advance one stage. Every
advance writes an append-only `production_stages` row keyed by the
operator email; the customer-facing order detail page reads from the
same table.

## R2 bucket setup

One private bucket per environment — `salishforge-dev` and `salishforge-prod` —
holding four key prefixes: `incoming/`, `uploads/`, `ai/`, `print/`. There is no
public bucket and no custom domain: public access in R2 is bucket-level, and
print files carry customer artwork, so reads go through presigned GETs instead.

Development points at the dev bucket rather than at local disk. That means
**development now needs network access and R2 credentials** — the trade is that
the storage path exercised on a laptop is the same one that runs in production.

1. **Create the bucket** — Cloudflare dashboard → R2 → Create bucket. Set the
   location hint to `wnam`; the shop and its customers are Pacific Northwest,
   and a bucket's location cannot be changed after creation. `salishforge-dev`
   already exists and sits in `ENAM` — it was created through the Cloudflare
   connector, which accepts only a name — which is acceptable for development
   and is not acceptable for `salishforge-prod`. Create that one in the
   dashboard.
2. **Create an API token** — R2 → Manage API Tokens → *Object Read & Write*,
   scoped to that one bucket. Copy the access key id and secret into
   `.env.local`; the account id is in the R2 sidebar.
3. **Set the CORS policy** — bucket → Settings → CORS policy, or the S3
   `PutBucketCors` operation with the same credentials. **This is
   load-bearing, not optional.** The customizer sets `crossOrigin="anonymous"`
   on every canvas image, so once `/api/assets/[id]` redirects to R2 the browser
   requires these headers. Without them images fail to load and the Konva stage
   renders empty *with no server-side error*.

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://salishforge.com"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["content-type", "content-length"],
       "ExposeHeaders": ["etag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   `PUT` and the two headers are for the browser's direct upload, whose
   signature covers exactly those headers.
4. **Set the lifecycle rule** — bucket → Settings → Object lifecycle rules →
   prefix `incoming/`, delete after **1 day**. This is the only garbage
   collection in the storage design: objects under `incoming/` are uploads
   abandoned before the browser called `/api/uploads/complete`. Without the
   rule they accumulate forever.

   If you set this through the S3 API instead
   (`PutBucketLifecycleConfiguration`), note that it **replaces the entire rule
   set**, not just the rule you name. A fresh R2 bucket ships with a
   `Default Multipart Abort Rule` (abort incomplete multipart uploads after 7
   days); send it back alongside yours or incomplete uploads bill forever. The
   dev bucket currently carries both rules.

`salishforge-dev` already has the CORS policy and both lifecycle rules applied.

Verify storage end to end by running the dev server and uploading an image in
the customizer. What that exercises: presign → direct PUT → server-side decode
and hash check → promotion out of `incoming/` → the `/api/assets/[id]` redirect
→ CORS on the canvas fetch.

## Print-ready files

`order_items.print_ready_files` is `[{ kind, filename, location, byteSize,
generatedAt }]`. Admin order detail (`/admin/orders/[id]`) renders a
download link per file pointing at
`/api/admin/print-fixtures/{orderId}/{itemId}/{filename}` (fixture mode).
Replace with presigned R2 URLs once `PRINT_STORAGE_BACKEND=r2` lands.

To regenerate files for an order (e.g. spec drift or operator edit), in the
Inngest dashboard manually replay the `order.print_files_needed` event
for the affected item ids. The function overwrites the existing fixture
files and updates `print_ready_files`.

### Print color space (CMYK)

UV-print and dye-sub PDFs are assembled in sRGB. Device-CMYK conversion is
capability-gated in `lib/print/cmyk.ts`: when a `gs` (Ghostscript) binary is
on the deploy target's PATH it converts the whole PDF to DeviceCMYK in one
pass; when absent it passes the sRGB bytes through unchanged for the printer
driver to color-manage. Vercel has no Ghostscript, so today every PDF is
sRGB — confirm with `gs --version`.

To turn on real CMYK output, run the print step on a Node host with
Ghostscript installed (the plan's Fly Machine escalation): `apt-get install
ghostscript`, redeploy, verify `gs --version` resolves. No code change is
needed — the conversion enables itself once `gs` is present.

## Design Console

`/admin/design` — pick a palette / font pairing / spacing scale from the
curated vocabulary. Every selection creates an immutable `theme_revisions`
row and flips `site_settings.active_theme_revision_id`. Rollback is one
button per row in the history table. All proposals pass through
`lib/design/brand-rules.ts` (sourced from `design_brief.md`); violating
proposals are rejected with a visible message before the row writes.

To extend the vocabulary (new palette, new font pairing, etc.), edit the
files in `lib/design/<vocab>/` and re-deploy. The Console picker reads
from those modules; no DB migration needed.

LLM-chat Console: lands when `ANTHROPIC_API_KEY` is wired. The tool
surface is the same Server Actions the manual form calls today
(`proposeAndApplyRevisionAction`, `rollbackToRevisionAction`).

## Adding a new SKU

1. `/admin/products/new` — fill in name, slug, category, decoration method,
   base price, lead time, status (start as draft).
2. `/admin/products/[id]` → Variants section → "+ New variant" → SKU,
   dimensions, optional weight/inventory.
3. `/admin/products/[id]/images` → upload hero + gallery images
   (requires CF Images creds).
4. Mark `status: active` on the product. The catalog + home tiles
   refresh within seconds (`revalidateTag('products')`).

## Failure replay

| Symptom | Cause | Recovery |
|---|---|---|
| Order paid, no email | `RESEND_API_KEY` unset at time of webhook | Configure key, replay `order.paid` from Inngest dashboard |
| Order paid, no print files | Inngest function errored | Inspect Inngest logs, fix root cause, replay `order.print_files_needed` per item |
| Customer says "I never got my design back" | Replicate generation row stuck `queued`/`running` | Check `aiGenerations` row by id; if Replicate webhook never landed, mark the row `failed` manually and let the customer regenerate (cached on cache_key so retries are free if prompt unchanged) |
| Admin can't log in | `ADMIN_EMAIL_ALLOWLIST` doesn't include their email | Update env, redeploy |
| Public site shows wrong theme | `revalidateTag('theme')` cache miss | Touch `site_settings` (re-save active row) to nudge cache |
| Stripe webhook returns 400 | Signature mismatch (wrong `STRIPE_WEBHOOK_SECRET`) | Check Stripe dashboard → webhook signing secret; update `.env` |
