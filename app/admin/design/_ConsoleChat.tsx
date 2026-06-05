"use client";

/*
 * Design Console chat UI.
 *
 * Holds the opaque Claude message history client-side and round-trips it
 * through sendConsoleMessage. The display transcript is kept separately from
 * that history so the rendered conversation stays clean while the model gets
 * the full tool-call plumbing it needs for multi-turn context.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import type Anthropic from "@anthropic-ai/sdk";

import type { ConsoleProposal } from "@/lib/claude/console-tools";
import { PrimaryButton, TextArea } from "@/components/admin/Field";

import { sendConsoleMessage } from "./_chat";
import { applyProposedRevisionAction } from "./_actions";

type InitialStatus = "ok" | "not_configured" | "disabled";

type DisplayTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; proposals: ConsoleProposal[] };

type Banner =
  | { kind: "not_configured" }
  | { kind: "disabled" }
  | { kind: "ceiling_reached"; spentCents: number; ceilingCents: number }
  | { kind: "error"; message: string }
  | null;

const dollars = (cents: number) => `$${(cents / 100).toFixed(4)}`;

function bannerCopy(banner: NonNullable<Banner>): string {
  switch (banner.kind) {
    case "not_configured":
      return "Console LLM is not configured. Set ANTHROPIC_API_KEY to enable chat-driven proposals. The manual tool surface below works without it.";
    case "disabled":
      return "Console is disabled — the daily cost ceiling is 0. Set DESIGN_CONSOLE_DAILY_COST_CEILING_USD_CENTS above 0 to enable.";
    case "ceiling_reached":
      return `Daily Console budget reached (${dollars(banner.spentCents)} of ${dollars(banner.ceilingCents)}). Resets at UTC midnight.`;
    case "error":
      return banner.message;
  }
}

function TokenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-0.5">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)]">
        {label}
      </span>
      <span className="font-mono text-xs text-[color:var(--color-ink-950)]">
        {value}
      </span>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: ConsoleProposal }) {
  const { tokens } = proposal;
  const layouts = Object.entries(tokens.layout_assignments ?? {});
  return (
    <div className="mt-3 border border-[color:var(--color-paper-300)] bg-[color:var(--color-paper-50)] p-4">
      <p className="text-sm text-[color:var(--color-ink-900)]">
        {proposal.rationale}
      </p>
      <div className="mt-3 border-t border-[color:var(--color-paper-300)] pt-3">
        <TokenRow label="Palette" value={tokens.palette_id} />
        <TokenRow label="Font" value={tokens.font_pairing_id} />
        <TokenRow label="Spacing" value={tokens.spacing_scale_id} />
        {layouts.map(([section, variantId]) => (
          <TokenRow key={section} label={section} value={variantId} />
        ))}
      </div>
      <form action={applyProposedRevisionAction} className="mt-4">
        <input type="hidden" name="revisionId" value={proposal.revisionId} />
        <PrimaryButton type="submit" className="!py-1.5 !text-[0.6rem]">
          Apply this revision
        </PrimaryButton>
      </form>
    </div>
  );
}

export function ConsoleChat({
  initialStatus,
}: {
  initialStatus: InitialStatus;
}) {
  const [history, setHistory] = useState<Anthropic.MessageParam[]>([]);
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [costCents, setCostCents] = useState(0);
  const [banner, setBanner] = useState<Banner>(
    initialStatus === "not_configured"
      ? { kind: "not_configured" }
      : initialStatus === "disabled"
        ? { kind: "disabled" }
        : null,
  );
  const [isPending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  const locked = initialStatus !== "ok";

  function submit() {
    const text = input.trim();
    if (!text || isPending || locked) return;
    setInput("");
    setBanner(null);
    setTurns((t) => [...t, { role: "user", text }]);
    startTransition(async () => {
      const result = await sendConsoleMessage(history, text, sessionId);
      if (result.status === "ok") {
        setHistory(result.messages);
        setSessionId(result.sessionId);
        setCostCents((c) => c + result.costCents);
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: result.assistantText,
            proposals: result.proposals,
          },
        ]);
        return;
      }
      setBanner(
        result.status === "ceiling_reached"
          ? {
              kind: "ceiling_reached",
              spentCents: result.spentCents,
              ceilingCents: result.ceilingCents,
            }
          : result.status === "error"
            ? { kind: "error", message: result.message }
            : { kind: result.status },
      );
    });
  }

  return (
    <section className="mb-14">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Chat with the curator
        </h2>
        {costCents > 0 ? (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
            Session {dollars(costCents)}
          </span>
        ) : null}
      </div>

      {banner ? (
        <div className="mb-4 border border-[color:var(--color-ember-700)] bg-[color:var(--color-paper-100)] px-4 py-3">
          <p className="text-sm text-[color:var(--color-ink-900)]">
            {bannerCopy(banner)}
          </p>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="mb-4 max-h-[28rem] overflow-y-auto border border-[color:var(--color-paper-300)] bg-white p-5"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-600)]">
            Ask for a change in plain language — e.g.{" "}
            <span className="italic">
              &ldquo;warmer accent and a more editorial body font&rdquo;
            </span>
            . The curator answers with named proposals you can apply.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] bg-[color:var(--color-ink-950)] px-4 py-2 text-sm text-[color:var(--color-paper-50)]">
                    {turn.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="max-w-[90%]">
                  {turn.text ? (
                    <p className="whitespace-pre-wrap text-sm text-[color:var(--color-ink-900)]">
                      {turn.text}
                    </p>
                  ) : null}
                  {turn.proposals.map((p) => (
                    <ProposalCard key={p.revisionId} proposal={p} />
                  ))}
                </div>
              ),
            )}
            {isPending ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Curator is thinking&hellip;
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            locked
              ? "Chat unavailable — see the notice above."
              : "Describe the change you want…"
          }
          disabled={locked || isPending}
          className="!min-h-[3rem] flex-1"
          rows={2}
        />
        <PrimaryButton
          type="button"
          onClick={submit}
          disabled={locked || isPending || !input.trim()}
        >
          Send
        </PrimaryButton>
      </div>
      <p className="mt-2 text-xs text-[color:var(--color-ink-600)]">
        The curator selects from the curated vocabulary only — it cannot write
        CSS, hex, or fonts. Every proposal is validated against{" "}
        <code className="font-mono">design_brief.md</code> before it can be
        applied.
      </p>
    </section>
  );
}
