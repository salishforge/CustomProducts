/*
 * AuthKit middleware.
 *
 * - Maintains the sealed-cookie session on every request.
 * - Gates /admin/* behind an admin role check.
 * - Public routes (storefront, customizer, cart) are not blocked; auth
 *   becomes required only at checkout and account routes.
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
      "/about",
      "/api/webhooks/(.*)",
      "/api/inngest",
      "/callback",
    ],
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"],
};
