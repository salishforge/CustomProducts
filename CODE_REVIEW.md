# CODE_REVIEW.md — Salishforge full audit (2026-06-06)

Security risk · correctness · efficiency · simplicity/doctrine review of the
Salishforge codebase. Findings were produced by three parallel reviews
(security; correctness+efficiency; simplicity+doctrine) and then **verified
against the real code** before triage — line numbers and severities below are
post-verification, not raw agent output.

Status legend: ✅ fixed · 🟡 mitigated/documented · ⬜ accepted (by-design) ·
❌ false positive.

## Threat model recap

The central security theme: **Server Actions are public network POST
endpoints.** Route-group middleware gates *pages*, not actions. Every action
must self-authorize — admin gate (`requireAdmin()`) or per-user/session
ownership. Admin actions were verified to call `requireAdmin()` uniformly; the
gaps were all on customer-facing actions that took an id from the client and
acted on it without an ownership check.

---

## CRITICAL

### C1 — Cart-item IDOR (no ownership check) ✅
`app/cart/_actions.ts` — `updateCartItemQuantityAction` and
`removeCartItemAction` took a `cartItemId` from the form and mutated/deleted it
with **no check that the item belongs to the caller's cart**. Any visitor could
edit or delete another shopper's cart items by id.
**Fix:** resolve the caller's cart (`findCurrentCart`) and constrain the
`UPDATE`/`DELETE` to `WHERE id = ? AND cart_id = <caller cart>`. No row → no-op.

### C2 — Buy-as-shown checkout crashes (NOT NULL violation) ✅
`lib/orders/from-checkout.ts:155` inserted
`customizationSnapshot: line.draft?.designState ?? null`, but
`order_items.customization_snapshot` is `jsonb ... NOT NULL`
(`drizzle/schema.ts:515`). Any "buy as shown" line (no design draft, created by
`addProductBuyAsShownAction`) makes the `order_items` insert throw **after** the
`orders` row was already written. The webhook 500s; Stripe retries hit
`onConflictDoNothing` on the payment-intent and no-op → a **paid order with no
items**, permanently.
**Fix:** make `customization_snapshot` nullable (the print dispatcher already
treats it as nullable — `lib/print/dispatch.ts:40-41`), regenerate the
migration, and create the order inside a transaction (C3) so a failure rolls
back cleanly.

### C3 — Order creation is not transactional ✅
`lib/orders/from-checkout.ts` wrote the `orders` row, then looped N
`order_items` inserts + draft-status updates, then the cart update, then fired
the Inngest `order.paid` event — all as separate awaited statements. A failure
mid-loop (or C2's throw) leaves a paid order with partial items and an
un-converted cart, and the `order.paid` fan-out may already have fired.
**Fix:** wrap order + items + draft updates + cart conversion in a single
`db.transaction(...)`. Send the Inngest event only **after** commit.

---

## HIGH

### H1 — AI generation-status IDOR ✅
`app/customize/[slug]/_actions/customizer.ts:100` →
`getGenerationStatus(generationId)` returned any generation's output asset URL
by id with no ownership scoping. cuid2 ids are unguessable so practical risk is
low, but it's a missing authorization check on a public action.
**Fix:** scope the lookup by the caller — owned generations match
`customer_id`; guest generations (`customer_id IS NULL`) remain pollable (the
client holds its own id from `createGeneration`, and there's no session to bind
them to).

### H2 — Guest-IP rate limit is a silent no-op ✅
`lib/replicate/rate-limit.ts:49` `checkGuestIpDailyCap` returned `{ ok: true }`
unconditionally, and `generateForCustomizerAction` never forwarded an IP — so
the guest cost cap was doubly inert. A silently-passing security control is
worse than none (false confidence), and it violates the "no half-finished
implementations" rule.
**Fix:** capture the client IP in the server action (`headers()`
x-forwarded-for), hash it (sha256 — never store raw IPs), persist it on
`ai_generations.guest_ip_hash`, and count by it inside the day window. The
per-customer cap, daily aggregate cost ceiling, and cache-key dedupe remain the
other defense layers.

### H3 — Print-fixtures path traversal via orderId/itemId 🟡→✅
`app/api/admin/print-fixtures/[orderId]/[itemId]/[filename]/route.ts:38` joins
`orderId` and `itemId` straight into a filesystem path; only `filename` was
checked for `..`/`/`. Behind `requireAdmin()`, so the blast radius is an authed
operator reading arbitrary files — still worth closing as defense-in-depth.
**Fix:** validate all three segments as cuid2 (`^[a-z0-9]+$`) before
`path.join`; reject otherwise.

---

## MEDIUM

### M1 — setHeroImageAction doesn't verify image ∈ product ✅
`app/admin/products/[id]/_actions/images.ts:94-107` set `products.hero_image_id`
to an `imageId` without confirming the image belongs to that product (unlike
`deleteImageAction`, which checks both). Admin-only, but a cheap consistency
fix.
**Fix:** verify `(imageId, productId)` exists in `product_images` first.

### M2 — SVG `esc()` doesn't escape quotes in attribute values ✅
`lib/print/svg-builder.ts:25-27` escapes only `& < >`. `esc()` is used for
`font-family="${esc(...)}"` — a double-quoted attribute — so a `"` in a font
name would break out and malform the print SVG.
**Fix:** also escape `"` and `'`. (Text-node usage stays correct; attribute
usage becomes correct too.)

### M3 — `nextOrderNumber` TOCTOU 🟡
`lib/orders/from-checkout.ts:29-36` derives the order number from
`count(*) + 1` under a unique index. Two concurrent checkouts can compute the
same number; the second insert throws. Now that order creation is wrapped in a
transaction (C3), the throw rolls the whole order back and Stripe's retry
recomputes a fresh number → self-healing. Acceptable at MVP volume; a Postgres
sequence is the durable fix when concurrency rises. Documented.

---

## LOW / efficiency / cleanup

### L1 — N+1 production-stages query ✅
`lib/queries/orders.ts:50-57` looped item ids issuing one query per item.
**Fix (structural):** single `inArray(productionStages.orderItemId, itemIds)`.

### L2 — Production board loads all order items, slices in JS 🟡
`app/admin/production/page.tsx:37-46` selects every non-filtered order item and
slices the shipped column to 25 in JS — the shipped set grows unbounded.
**Mitigation:** acceptable at MVP order volume; documented. A SQL-side
`shipped` cap is the follow-up when volume warrants.

### L3 — Dead code ✅
`customerSoftCapReached` and `RATE_LIMITS` (`lib/replicate/rate-limit.ts`) have
no callers; `publishDraftPreviewAction` (`customizer.ts`) is an unused no-op
stub. Removed.

### L4 — `sha256Hex` needlessly async ✅
`app/api/webhooks/replicate/route.ts:18-20` wrapped a sync hash in an `async`
function. Inlined/desync'd.

### L5 — Replicate webhook signature format 🟡
`route.ts:38-48` HMACs the raw body and hex-compares against the
`webhook-signature` header. Replicate's real format is svix-style
(`v1,<base64>` over `id.timestamp.body`), so this won't validate production
signatures as written. The dev-skip is correctly gated to non-production.
Documented as Phase-2 work, to land **with** the actual Replicate call (L6) —
verifying a format we can't yet exercise end-to-end would be untested code.

### L6 — Replicate call unimplemented 🟡
`inngest/functions/run-generation.ts:52-55` logs "would call Replicate" and
suspends on the completion event. Known Phase-2 scaffold; the function signature
and event wiring are final. No live AI spend occurs today, which is also why
H2's cap and the cost ceiling are currently inert backstops. Documented.

### L7 — `resolve.ts` asset fetch (SSRF-shaped) ⬜
`lib/print/resolve.ts:63-69` `fetch(row.r2Key)`. `r2Key` is **server-written**
(our own `/api/assets/{id}` URL for uploads, or the Replicate output URL for
generations) — never user-settable — and runs in a background print job, not a
request path. Not exploitable. The existing `^https?://` guard stays. By-design.

### L8 — Moderation fails open ⬜
`lib/replicate/moderation.ts:42-46` accepts the prompt on OpenAI API error and
when no key is set. Intentional: a moderation outage shouldn't take down the
storefront; output post-moderation is the second layer. Documented in-file.

### L9 — `/api/assets/[id]` is public ⬜
`app/api/assets/[id]/route.ts` serves upload bytes with no auth. By design —
CDN-style delivery of customizer images by unguessable cuid2, equivalent to a
signed object URL. Only `kind='upload'` is served.

### L10 — `getSession().catch(() => null)` ⬜
Several actions swallow auth errors and proceed as guest. Correct behavior — a
missing/invalid session *is* the unauthenticated case — and ownership checks
(C1/H1) now gate what a guest can touch. Kept.

### L11 — "TODO" embedded in generated SVG comment ✅
`lib/print/svg-builder.ts:66` shipped a `TODO` inside the print file's comment.
Reworded to a plain operator note (keeps the grep-clean rule; the note itself
is useful to whoever opens the file).

### L12 — `dispatch.ts` default branch ⬜
`lib/print/dispatch.ts:72-82` emits SVG for an unknown decoration method. This
is a deliberate permissive default at a data boundary (`decorationMethod` from a
snapshot), giving the operator *something* to inspect. Postel-at-the-edge;
documented in-file. Kept.

### Price-at-checkout ⬜
`unitPriceCents` is computed server-side from `base_price + variant delta` at
add-to-cart and locked into the cart row; it is never client-supplied and not
mutated by the (now ownership-scoped) cart actions. Price-at-add-to-cart is a
deliberate commerce model. By-design.

---

## False positives (investigated, no change)

### FP1 — "catalog/settings cache key omits the argument" ❌
Flagged for `getProductBySlug(slug)` (`lib/queries/catalog.ts`) and
`getRaw(key)` (`lib/queries/settings.ts`): the worry was that all slugs/keys
share one cache entry. **Not a bug.** `unstable_cache(fn, keyParts, opts)`
includes the function's *arguments* in the cache key automatically; `keyParts`
are *additional* discriminators. Distinct slugs/keys cache independently. No
change.

---

## Verified safe (spot-checks that passed)

- All `/admin/**` Server Actions call `requireAdmin()`.
- Stripe webhook: raw-body HMAC verify + `webhook_events` idempotency.
- Server-side price integrity: cart `unitPriceCents` is DB-derived, never from
  the client.
- Drizzle queries are fully parameterized (no string-interpolated SQL).
- Account order detail (`getOrderWithItems(id, customerId)`) is scoped to the
  caller's `customer_id`.
- Console tool surface (`lib/claude/*`) is Zod-validated; the browser never sees
  the API key, the brief, or raw tool plumbing.
- Customizer upload validates MIME ∩ 15 MB ∩ real `sharp` decode.
- No `NEXT_PUBLIC_*` leakage of secret material.
