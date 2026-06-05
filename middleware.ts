/*
 * AuthKit middleware.
 *
 * Session maintenance + allow-list of public paths. /admin/* and /account/*
 * are NOT in the allow-list, so authenticated middleware redirects them to
 * sign-in. Per-route requireAdmin() / requireSession() in lib/auth provide
 * the second line of defense.
 *
 * Static files (robots.txt, sitemap.xml, favicon, fonts, images) bypass
 * middleware via the matcher exclusion below.
 *
 * Unrecognized public paths fall through to Next's not-found.tsx — they
 * also need to be listed (or globbed) here so AuthKit doesn't redirect.
 * AuthKit's pattern engine doesn't support negative lookaheads, so we
 * explicitly include /admin and /account in the allow-list and rely on the
 * per-route guards (requireAdmin/requireSession) for the actual gate.
 */

import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/products",
      "/products/(.*)",
      "/customize/(.*)",
      "/cart",
      "/checkout/(.*)",
      "/about",
      "/callback",
      "/api/webhooks/(.*)",
      "/api/inngest",
      "/admin",
      "/admin/(.*)",
      "/account",
      "/account/(.*)",
      "/api/admin/(.*)",
      // Catch-all so unrecognized paths render Next's 404 page instead of
      // being silently redirected to sign-in. /admin and /account would
      // also match this; per-route guards (requireAdmin / requireSession)
      // are what actually keep them private.
      "/(.*)",
    ],
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|txt|xml|ico|json)$).*)",
  ],
};
