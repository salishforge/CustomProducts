/*
 * Design Console pricing + config gates.
 *
 * Pure, dependency-free half of the Console: token-cost math and the env-driven
 * enable/ceiling gates. Split out from console.ts (which imports `server-only`,
 * the Anthropic SDK, and the db) so this logic is unit-testable without a server
 * runtime. console.ts re-exports these as the module's public face.
 */

// Sonnet pricing in cents per million tokens. Cache writes bill at 1.25x input,
// cache reads at 0.1x. Update alongside the model default in console.ts.
export const RATE_CENTS_PER_MTOK = {
  input: 300,
  output: 1500,
  cacheWrite: 375,
  cacheRead: 30,
} as const;

const DEFAULT_CEILING_CENTS = 200;

export type ConsoleUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Pure: dollar-cents cost of one API response from its token usage. */
export function consoleCostCents(usage: ConsoleUsage): number {
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    (usage.input_tokens * RATE_CENTS_PER_MTOK.input +
      usage.output_tokens * RATE_CENTS_PER_MTOK.output +
      cacheWrite * RATE_CENTS_PER_MTOK.cacheWrite +
      cacheRead * RATE_CENTS_PER_MTOK.cacheRead) /
    1_000_000
  );
}

export function isConsoleConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function consoleCeilingCents(): number {
  const parsed = Number.parseInt(
    process.env.DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS ?? "",
    10,
  );
  return Number.isFinite(parsed) ? parsed : DEFAULT_CEILING_CENTS;
}

/** Configured AND not hard-disabled (ceiling 0 turns the console off). */
export function consoleEnabled(): boolean {
  return isConsoleConfigured() && consoleCeilingCents() > 0;
}
