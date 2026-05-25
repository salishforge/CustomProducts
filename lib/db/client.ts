/*
 * Postgres client (postgres-js driver + drizzle-orm).
 *
 * The drizzle instance is constructed lazily on first property access so the
 * module is safe to import at build time without DATABASE_URL set. Vercel /
 * `next build` collect-page-data step imports route modules eagerly, and we
 * don't want a missing env var to fail the build.
 *
 * Postgres connection lives on `globalThis` so Vercel Node functions reuse
 * the same pool across warm invocations. Pooling itself happens at Neon's
 * PgBouncer endpoint — point DATABASE_URL at the pooled URL,
 * DATABASE_DIRECT_URL at the direct URL for migrations.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/drizzle/schema";

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __sf_pg__: ReturnType<typeof postgres> | undefined;
  var __sf_db__: DrizzleClient | undefined;
}

function buildClient(): DrizzleClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  if (!globalThis.__sf_pg__) {
    globalThis.__sf_pg__ = postgres(url, {
      prepare: false, // PgBouncer transaction mode requires prepare=false
      max: 10,
      idle_timeout: 20,
    });
  }
  return drizzle(globalThis.__sf_pg__, { schema });
}

/** Lazy proxy: real client constructed on first property access. */
export const db: DrizzleClient = new Proxy({} as DrizzleClient, {
  get(_target, prop, receiver) {
    if (!globalThis.__sf_db__) {
      globalThis.__sf_db__ = buildClient();
    }
    return Reflect.get(globalThis.__sf_db__, prop, receiver);
  },
});

export { schema };
