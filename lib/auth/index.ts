/*
 * Auth helpers.
 *
 * Wraps @workos-inc/authkit-nextjs so the rest of the app reads from a
 * narrow interface. Role gate for admin lives here so adding new admin
 * routes is one import.
 */

import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

const ADMIN_EMAIL_ALLOWLIST = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Get the current session if any; null for anonymous. */
export async function getSession() {
  return withAuth();
}

/** Require authentication, otherwise redirect to sign-in. */
export async function requireSession() {
  const session = await withAuth({ ensureSignedIn: true });
  return session;
}

/** Require an admin session. Operator-only paths use this. */
export async function requireAdmin() {
  const session = await withAuth({ ensureSignedIn: true });
  const email = session.user.email?.toLowerCase();
  if (!email || !ADMIN_EMAIL_ALLOWLIST.includes(email)) {
    redirect("/");
  }
  return session;
}
