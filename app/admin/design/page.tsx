import { requireAdmin } from "@/lib/auth";
import { FONT_PAIRINGS } from "@/lib/design/font-pairings";
import {
  LAYOUT_VARIANTS,
  SECTION_IDS,
  resolveLayoutVariant,
} from "@/lib/design/layouts";
import { PALETTES } from "@/lib/design/palettes";
import { SPACING_SCALES } from "@/lib/design/spacing";
import { getActiveTheme } from "@/lib/theme/resolve";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
} from "@/components/admin/Field";

import {
  listRevisions,
  proposeAndApplyRevisionAction,
  rollbackToRevisionAction,
} from "./_actions";

export const dynamic = "force-dynamic";

export default async function AdminDesignConsole() {
  await requireAdmin();
  const [theme, revisions] = await Promise.all([
    getActiveTheme(),
    listRevisions(),
  ]);

  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Design
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Console.
        </h1>
        <p className="mt-4 text-sm text-[color:var(--color-ink-800)] max-w-2xl">
          Pick from the curated vocabulary. Every change creates an immutable
          theme revision; the active revision&rsquo;s tokens are SSR-injected
          into <code className="font-mono text-xs">&lt;html&gt;</code> so the
          public site updates on the next request. Rollback is one click.
        </p>
        <p className="mt-2 text-xs text-[color:var(--color-ink-600)]">
          The chat-driven LLM proposal flow lands when the Anthropic SDK is
          wired (env <code className="font-mono text-[0.65rem]">ANTHROPIC_API_KEY</code>);
          this form is the same tool surface, just operated by hand.
        </p>
      </header>

      <section className="mb-12 grid grid-cols-3 gap-6">
        {[
          { label: "Palette", value: theme.palette.name, desc: theme.palette.description },
          { label: "Font pairing", value: theme.fontPairing.name, desc: theme.fontPairing.displayLabel },
          { label: "Spacing", value: theme.spacingScale.name, desc: theme.spacingScale.description },
        ].map((c) => (
          <div key={c.label} className="border-l border-[color:var(--color-paper-300)] pl-4 py-1">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              {c.label}
            </p>
            <p
              className="mt-1 font-display text-xl"
              style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}
            >
              {c.value}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-600)]">{c.desc}</p>
          </div>
        ))}
      </section>

      <section className="mb-14">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Propose a new revision
        </h2>
        <form action={proposeAndApplyRevisionAction} className="grid grid-cols-3 gap-4">
          <Field label="Palette" htmlFor="palette_id" required>
            <SelectInput
              id="palette_id"
              name="palette_id"
              defaultValue={theme.palette.id}
              required
            >
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Font pairing" htmlFor="font_pairing_id" required>
            <SelectInput
              id="font_pairing_id"
              name="font_pairing_id"
              defaultValue={theme.fontPairing.id}
              required
            >
              {FONT_PAIRINGS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Spacing scale" htmlFor="spacing_scale_id" required>
            <SelectInput
              id="spacing_scale_id"
              name="spacing_scale_id"
              defaultValue={theme.spacingScale.id}
              required
            >
              {SPACING_SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          {SECTION_IDS.map((section) => {
            const fieldId = `layout_${section.replace(/\./g, "_")}`;
            return (
              <Field key={section} label={`Layout · ${section}`} htmlFor={fieldId}>
                <SelectInput
                  id={fieldId}
                  name={`layout:${section}`}
                  defaultValue={resolveLayoutVariant(
                    section,
                    theme.layoutAssignments,
                  )}
                >
                  {LAYOUT_VARIANTS[section].map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            );
          })}
          <div className="col-span-3 flex items-center gap-3 pt-2">
            <PrimaryButton type="submit">Apply revision</PrimaryButton>
            <span className="text-xs text-[color:var(--color-ink-600)]">
              Validated against <code className="font-mono">design_brief.md</code> before write.
            </span>
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Revision history
        </h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-600)]">No revisions yet.</p>
        ) : (
          <ul>
            {revisions.map((r) => {
              const t = r.tokens as {
                palette_id?: string;
                font_pairing_id?: string;
                spacing_scale_id?: string;
              };
              const isActive = theme.revisionId === r.id;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-12 gap-4 items-baseline py-4 border-t border-[color:var(--color-paper-300)]"
                >
                  <div className="col-span-3 font-mono text-xs text-[color:var(--color-ink-600)] nums-tabular">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  <div className="col-span-2 font-mono text-xs">
                    {t.palette_id}
                  </div>
                  <div className="col-span-3 font-mono text-xs">
                    {t.font_pairing_id}
                  </div>
                  <div className="col-span-2 font-mono text-xs">
                    {t.spacing_scale_id}
                  </div>
                  <div className="col-span-2 text-right">
                    {isActive ? (
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ember-700)]">
                        Active
                      </span>
                    ) : (
                      <form action={rollbackToRevisionAction}>
                        <input type="hidden" name="revisionId" value={r.id} />
                        <SecondaryButton type="submit" className="!py-1 !text-[0.6rem]">
                          Rollback
                        </SecondaryButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
