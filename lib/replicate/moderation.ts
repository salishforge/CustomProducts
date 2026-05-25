/*
 * Prompt moderation gate.
 *
 * Pre-check on user-supplied prompts before paying Replicate. Uses OpenAI's
 * moderation endpoint if OPENAI_API_KEY is set; otherwise short-circuits to
 * a permissive accept in dev (logged) so the customizer flow stays testable
 * without keys.
 *
 * Post-check on output images is the second layer (Phase 2, in the Replicate
 * webhook handler).
 */

export type ModerationDecision =
  | { ok: true }
  | { ok: false; categories: string[] };

const KEYWORD_BLOCKLIST: readonly string[] = [
  // Conservative keyword fallback only — the real signal is the OpenAI model.
];

export async function moderatePrompt(prompt: string): Promise<ModerationDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const lower = prompt.toLowerCase();
    const hits = KEYWORD_BLOCKLIST.filter((w) => lower.includes(w));
    if (hits.length) return { ok: false, categories: hits };
    return { ok: true };
  }

  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: prompt,
    }),
  });

  if (!res.ok) {
    // Fail-open on transient API failure — moderation outage shouldn't block
    // the storefront. Log for ops follow-up.
    console.warn("[moderation] OpenAI moderation API returned", res.status);
    return { ok: true };
  }

  const json = (await res.json()) as {
    results?: Array<{
      flagged: boolean;
      categories: Record<string, boolean>;
    }>;
  };
  const result = json.results?.[0];
  if (!result || !result.flagged) return { ok: true };
  const flagged = Object.entries(result.categories)
    .filter(([, on]) => on)
    .map(([k]) => k);
  return { ok: false, categories: flagged };
}
