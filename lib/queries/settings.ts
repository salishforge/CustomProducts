/*
 * site_settings reads.
 *
 * Wraps the KV table in a typed accessor with a default fallback. Admin
 * writes invalidate via revalidateTag('settings').
 */

import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { siteSettings } from "@/drizzle/schema";

const getRaw = unstable_cache(
  async (key: string): Promise<unknown> => {
    const rows = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  },
  ["settings", "by-key"],
  { tags: ["settings"], revalidate: 60 },
);

/** Typed accessor with a default. Caller is responsible for the shape — the
 *  KV is jsonb so any reasonable shape is fair game; settings used in code
 *  should be parsed through a Zod schema at the read site. */
export async function getSiteSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await getRaw(key);
  return value === null ? fallback : (value as T);
}

export async function getActiveThemeRevisionId(): Promise<string | null> {
  return getSiteSetting<string | null>("active_theme_revision_id", null);
}
