import Stripe from "stripe";

declare global {
  var __sf_stripe__: Stripe | undefined;
}

/** Lazy accessor. Throws at first call if STRIPE_SECRET_KEY is missing —
 *  never at module load (so the module is safe to import at build time). */
export function stripeClient(): Stripe {
  if (!globalThis.__sf_stripe__) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    globalThis.__sf_stripe__ = new Stripe(key, {
      // Pin to the SDK's declared latest version; bump in lockstep with @stripe upgrades.
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return globalThis.__sf_stripe__;
}
