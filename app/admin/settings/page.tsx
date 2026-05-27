import { asc } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { siteSettings } from "@/drizzle/schema";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import { deleteSettingAction, upsertSettingAction } from "./_actions";

export const dynamic = "force-dynamic";

function valueDisplay(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

export default async function AdminSettings() {
  await requireAdmin();

  const rows = await db
    .select()
    .from(siteSettings)
    .orderBy(asc(siteSettings.scope), asc(siteSettings.key));

  return (
    <div className="max-w-3xl">
      <header className="mb-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Content
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Site settings.
        </h1>
        <p className="mt-4 text-sm text-[color:var(--color-ink-800)] max-w-2xl">
          Operator-editable key/value store. Values may be plain strings or
          JSON literals (e.g. <code className="font-mono text-xs">true</code>,{" "}
          <code className="font-mono text-xs">{`{"min": 7}`}</code>) — values
          that parse as JSON are stored as their typed form.
        </p>
      </header>

      {rows.length > 0 ? (
        <section className="mb-14">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
            Existing
          </h2>
          <ul className="flex flex-col">
            {rows.map((s) => (
              <li
                key={s.key}
                className="border-t border-[color:var(--color-paper-300)] py-5 grid grid-cols-12 gap-4 items-start"
              >
                <div className="col-span-3">
                  <p className="font-mono text-sm text-[color:var(--color-ink-950)]">{s.key}</p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] mt-1">
                    {s.scope}
                  </p>
                </div>
                <div className="col-span-7">
                  <pre className="font-mono text-xs text-[color:var(--color-ink-800)] bg-[color:var(--color-paper-100)] p-3 overflow-x-auto whitespace-pre-wrap">
                    {valueDisplay(s.value)}
                  </pre>
                </div>
                <form action={deleteSettingAction} className="col-span-2 flex justify-end">
                  <input type="hidden" name="key" value={s.key} />
                  <SecondaryButton type="submit">Delete</SecondaryButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Add or update
        </h2>
        <form action={upsertSettingAction} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Key"
              htmlFor="key"
              hint="snake_case, e.g. shipping_policy"
              required
            >
              <TextInput
                id="key"
                name="key"
                required
                pattern="[a-z0-9_]+"
                placeholder="shipping_policy"
              />
            </Field>
            <Field label="Scope" htmlFor="scope" hint="UI grouping label">
              <TextInput
                id="scope"
                name="scope"
                defaultValue="misc"
                placeholder="misc / copy / flags / theme"
              />
            </Field>
          </div>
          <Field
            label="Value"
            htmlFor="value"
            hint="Plain string, or JSON literal (parsed when valid)."
            required
          >
            <TextArea id="value" name="value" rows={5} required />
          </Field>
          <PrimaryButton type="submit">Save setting</PrimaryButton>
        </form>
      </section>
    </div>
  );
}
