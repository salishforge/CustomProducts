/*
 * Centralized pino logger.
 *
 * Reads SF_LOG_LEVEL (default 'info'). In production we emit unadorned JSON
 * so Vercel's log pipeline captures structured fields; in dev we use
 * pino-pretty if it's installed, otherwise plain JSON.
 *
 * Sentry is wired separately via @sentry/nextjs once the DSN lands — see
 * OPS.md for the runbook.
 */

import pino, { type Logger } from "pino";

declare global {
  var __sf_logger__: Logger | undefined;
}

function build(): Logger {
  const level = process.env.SF_LOG_LEVEL ?? "info";
  // Don't try to enable pino-pretty when it's not installed; pino will throw.
  return pino({
    level,
    base: { service: "salishforge" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const log: Logger = (globalThis.__sf_logger__ ??= build());
