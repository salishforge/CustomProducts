import type { Config } from "drizzle-kit";
import { existsSync } from "node:fs";

// drizzle-kit runs as a standalone Node process and doesn't pick up Next.js's
// .env.local automatically. Load it explicitly when present.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
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
