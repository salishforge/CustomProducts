import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_DIRECT_URL && !process.env.DATABASE_URL) {
  // Drizzle-kit reads this file at CLI time. We don't want to block local
  // schema-typecheck if the env isn't set yet; we only require it at migrate time.
  // The schema is still importable and typecheckable without the URL.
}

const config: Config = {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgres://placeholder@localhost/placeholder",
  },
  strict: true,
  verbose: true,
};

export default config;
