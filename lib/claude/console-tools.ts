/*
 * Design Console tool surface.
 *
 * The Console LLM is a curator, not a generator: it can only read the curated
 * vocabularies and propose a revision assembled from registered ids. These are
 * the *only* ways it mutates state — there is no free-form CSS/hex/JSX path.
 *
 * Each tool has a server-side executor. `propose_revision` merges the proposed
 * ids over the currently-active theme (so "just change the font" keeps the rest
 * intact), runs the brand-rule validator, and only on a clean pass writes a
 * `draft` revision the operator can apply. Violations come back to the LLM so it
 * can try again within the brief.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { themeRevisions } from "@/drizzle/schema";
import {
  validateRevision,
  type ThemeRevisionTokens,
} from "@/lib/design/brand-rules";
import { FONT_PAIRINGS } from "@/lib/design/font-pairings";
import { LAYOUT_VARIANTS, SECTION_IDS, isSectionId } from "@/lib/design/layouts";
import { PALETTES } from "@/lib/design/palettes";
import { SPACING_SCALES } from "@/lib/design/spacing";
import { getActiveTheme } from "@/lib/theme/resolve";

export type ConsoleToolContext = {
  operatorEmail: string;
  sessionId: string;
};

/** A draft proposal surfaced to the operator as an actionable card. */
export type ConsoleProposal = {
  revisionId: string;
  tokens: ThemeRevisionTokens;
  rationale: string;
};

export const CONSOLE_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_palettes",
    description:
      "List the curated OKLCH palettes the operator can switch to. Returns id, name, and a one-line description for each.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_font_pairings",
    description:
      "List the curated (display, body, mono) font pairings. The display face is always an editorial serif. Returns id, name, label, and description.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_spacing_scales",
    description:
      "List the curated spacing scales (rhythm/density). Returns id, name, and description.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_layouts",
    description:
      "List the layout variants available per page section. Optionally filter to one section. Returns each variant's id, name, description, and whether it is a broken-grid (editorial) layout.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: `Optional section id to filter by. One of: ${SECTION_IDS.join(", ")}.`,
        },
      },
    },
  },
  {
    name: "propose_revision",
    description:
      "Assemble a theme revision from registered ids and propose it to the operator. Any field you omit keeps the currently-active value. The revision is validated against the brand rules; if it violates a rule the proposal is rejected and the violations are returned so you can revise. Always include a terse, shop-floor rationale.",
    input_schema: {
      type: "object",
      properties: {
        palette_id: { type: "string", description: "A palette id from list_palettes." },
        font_pairing_id: {
          type: "string",
          description: "A font pairing id from list_font_pairings.",
        },
        spacing_scale_id: {
          type: "string",
          description: "A spacing scale id from list_spacing_scales.",
        },
        layout_assignments: {
          type: "object",
          description: `Map of section id to variant id (from list_layouts). Sections: ${SECTION_IDS.join(", ")}.`,
          additionalProperties: { type: "string" },
        },
        rationale: {
          type: "string",
          description:
            "One or two terse sentences explaining the change in the brand's shop-floor voice. Shown on the operator's proposal card.",
        },
      },
      required: ["rationale"],
    },
  },
];

const proposeInputSchema = z.object({
  palette_id: z.string().optional(),
  font_pairing_id: z.string().optional(),
  spacing_scale_id: z.string().optional(),
  layout_assignments: z.record(z.string(), z.string()).optional(),
  rationale: z.string().min(1),
});

const listLayoutsInputSchema = z.object({
  section: z.string().optional(),
});

function layoutsForSection(section: (typeof SECTION_IDS)[number]) {
  return LAYOUT_VARIANTS[section].map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    broken_grid: v.brokenGrid,
  }));
}

/**
 * Run a tool by name. `input` is the raw LLM-provided argument object (a system
 * boundary), so it is parsed before use. The return value is JSON-serialized
 * into the tool_result block by the orchestrator.
 */
export async function executeConsoleTool(
  name: string,
  input: unknown,
  ctx: ConsoleToolContext,
): Promise<{ result: unknown; proposal?: ConsoleProposal }> {
  switch (name) {
    case "list_palettes":
      return {
        result: PALETTES.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        })),
      };
    case "list_font_pairings":
      return {
        result: FONT_PAIRINGS.map((f) => ({
          id: f.id,
          name: f.name,
          label: f.displayLabel,
          description: f.description,
        })),
      };
    case "list_spacing_scales":
      return {
        result: SPACING_SCALES.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
      };
    case "list_layouts": {
      const parsed = listLayoutsInputSchema.parse(input ?? {});
      if (parsed.section && isSectionId(parsed.section)) {
        return { result: { [parsed.section]: layoutsForSection(parsed.section) } };
      }
      const all: Record<string, ReturnType<typeof layoutsForSection>> = {};
      for (const section of SECTION_IDS) all[section] = layoutsForSection(section);
      return { result: all };
    }
    case "propose_revision": {
      const parsed = proposeInputSchema.parse(input);
      const active = await getActiveTheme();
      const tokens: ThemeRevisionTokens = {
        palette_id: parsed.palette_id ?? active.palette.id,
        font_pairing_id: parsed.font_pairing_id ?? active.fontPairing.id,
        spacing_scale_id: parsed.spacing_scale_id ?? active.spacingScale.id,
        layout_assignments: {
          ...active.layoutAssignments,
          ...(parsed.layout_assignments ?? {}),
        },
      };
      const validation = validateRevision(tokens);
      if (!validation.ok) {
        return {
          result: {
            ok: false,
            violations: validation.violations,
            note: "Rejected by the brand rules. Pick different ids and propose again.",
          },
        };
      }
      const revisionId = newId();
      await db.insert(themeRevisions).values({
        id: revisionId,
        parentId: active.revisionId,
        tokens: tokens as unknown as Record<string, unknown>,
        proposedByEmail: ctx.operatorEmail,
        proposedByLlmSessionId: ctx.sessionId,
        status: "draft",
      });
      return {
        result: { ok: true, revision_id: revisionId, tokens },
        proposal: { revisionId, tokens, rationale: parsed.rationale },
      };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
