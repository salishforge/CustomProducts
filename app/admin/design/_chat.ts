"use server";

import type Anthropic from "@anthropic-ai/sdk";

import { requireAdmin } from "@/lib/auth";
import { runConsoleTurn, type ConsoleTurnResult } from "@/lib/claude/console";

/**
 * One Console chat turn. The browser holds the opaque message history and
 * round-trips it here; the operator email is taken from the admin session, not
 * the client. All Claude plumbing (API key, brief, tool surface) stays server
 * side — this is the only door the chat UI talks through.
 */
export async function sendConsoleMessage(
  history: Anthropic.MessageParam[],
  userText: string,
  sessionId?: string,
): Promise<ConsoleTurnResult> {
  const session = await requireAdmin();
  return runConsoleTurn({
    history,
    userText,
    operatorEmail: session.user.email ?? "admin",
    sessionId,
  });
}
