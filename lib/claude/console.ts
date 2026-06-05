/*
 * Design Console orchestrator.
 *
 * Runs one operator turn against Claude with the brand brief as a cached system
 * prompt and the curator tool surface. The tool loop is server-side only — the
 * browser never sees the API key, the brief, or the raw tool plumbing; it round-
 * trips an opaque message history and renders the assistant text + proposals.
 *
 * Spend is bounded three ways: the console is disabled unless ANTHROPIC_API_KEY
 * is set and the daily ceiling is > 0; a per-UTC-day spend counter in
 * site_settings (mirrors the Replicate kill switch) pauses the console once the
 * ceiling is hit; and every turn is capped by max_tokens and a tool-loop limit.
 */

import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { siteSettings } from "@/drizzle/schema";

import {
  CONSOLE_TOOLS,
  executeConsoleTool,
  type ConsoleProposal,
} from "./console-tools";
import {
  consoleCeilingCents,
  consoleCostCents,
  consoleEnabled,
  isConsoleConfigured,
  type ConsoleUsage,
} from "./console-config";

// Re-export the pure config/pricing surface so callers have a single Console
// entry point; the definitions live in console-config.ts for testability.
export {
  consoleCeilingCents,
  consoleCostCents,
  consoleEnabled,
  isConsoleConfigured,
  type ConsoleUsage,
};

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 8;
const MAX_OUTPUT_TOKENS = 1500;

function spendKeyForToday(): string {
  return `console:spend:${new Date().toISOString().slice(0, 10)}`;
}

async function readConsoleSpendCents(): Promise<number> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, spendKeyForToday()))
    .limit(1);
  return typeof row?.value === "number" ? row.value : 0;
}

async function recordConsoleSpendCents(cents: number): Promise<void> {
  const key = spendKeyForToday();
  const current = await readConsoleSpendCents();
  await db
    .insert(siteSettings)
    .values({ key, value: current + cents, scope: "console" })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: current + cents, updatedAt: new Date() },
    });
}

let cachedBrief: string | null = null;
function brandBrief(): string {
  if (cachedBrief === null) {
    cachedBrief = readFileSync(join(process.cwd(), "design_brief.md"), "utf8");
  }
  return cachedBrief;
}

function systemPrompt(): string {
  return [
    "You are the Salishforge Design Console — a curator of the brand's visual",
    "identity, embedded in the admin. You do not write CSS, hex codes, font",
    "URLs, or JSX. You select from a curated vocabulary (palettes, font",
    "pairings, spacing scales, layout variants) using the provided tools, then",
    "assemble a proposal with propose_revision for the operator to apply.",
    "",
    "Rules of engagement:",
    "- Discover ids with the list_* tools before proposing; never invent an id.",
    "- Omit any field in propose_revision that should stay as-is; omitted fields",
    "  keep the currently-active value.",
    "- If a proposal is rejected for a brand-rule violation, read the violation",
    "  and propose a compliant alternative — do not argue the rule.",
    "- Speak in the brand voice: terse, concrete, shop-floor. No marketing gloss.",
    "- One change at a time unless the operator asks for several.",
    "",
    "The brand brief below is the contract. Proposals are validated against it.",
    "",
    "----- design_brief.md -----",
    brandBrief(),
  ].join("\n");
}

function toolsWithCache(): Anthropic.Tool[] {
  // Cache the (stable) tool definitions alongside the system prompt by marking
  // the final tool. The SDK caches everything up to and including the marker.
  return CONSOLE_TOOLS.map((tool, i) =>
    i === CONSOLE_TOOLS.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" } }
      : tool,
  );
}

export type ConsoleTurnResult =
  | { status: "not_configured" }
  | { status: "disabled" }
  | { status: "ceiling_reached"; spentCents: number; ceilingCents: number }
  | { status: "error"; message: string }
  | {
      status: "ok";
      sessionId: string;
      messages: Anthropic.MessageParam[];
      assistantText: string;
      proposals: ConsoleProposal[];
      costCents: number;
    };

export type ConsoleTurnInput = {
  history: Anthropic.MessageParam[];
  userText: string;
  operatorEmail: string;
  sessionId?: string;
};

export async function runConsoleTurn(
  input: ConsoleTurnInput,
): Promise<ConsoleTurnResult> {
  if (!isConsoleConfigured()) return { status: "not_configured" };
  const ceilingCents = consoleCeilingCents();
  if (ceilingCents <= 0) return { status: "disabled" };

  const spentCents = await readConsoleSpendCents();
  if (spentCents >= ceilingCents) {
    return { status: "ceiling_reached", spentCents, ceilingCents };
  }

  const sessionId = input.sessionId ?? newId();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.DESIGN_CONSOLE_MODEL ?? DEFAULT_MODEL;

  const messages: Anthropic.MessageParam[] = [
    ...input.history,
    { role: "user", content: input.userText },
  ];
  const proposals: ConsoleProposal[] = [];
  let costCents = 0;

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          {
            type: "text",
            text: systemPrompt(),
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: toolsWithCache(),
        messages,
      });
      costCents += consoleCostCents(response.usage);
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const { result, proposal } = await executeConsoleTool(
          block.name,
          block.input,
          { operatorEmail: input.operatorEmail, sessionId },
        );
        if (proposal) proposals.push(proposal);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    await recordConsoleSpendCents(costCents);

    const last = messages[messages.length - 1];
    const assistantText =
      last && last.role === "assistant" && Array.isArray(last.content)
        ? last.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim()
        : "";

    return {
      status: "ok",
      sessionId,
      messages,
      assistantText,
      proposals,
      costCents,
    };
  } catch (error) {
    // The Anthropic API is an external boundary: auth failures, rate limits,
    // and network errors all surface here. Record any spend already incurred
    // so a mid-loop failure can't bypass the ceiling, then report cleanly.
    if (costCents > 0) await recordConsoleSpendCents(costCents);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude API error (${error.status ?? "network"}): ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error talking to Claude.";
    return { status: "error", message };
  }
}
