import { asc } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { productCategories } from "@/drizzle/schema";
import {
  Field,
  NumberInput,
  PrimaryButton,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import { upsertCategoryAction } from "./_actions";

export const dynamic = "force-dynamic";

/** All 9 categories from the product_category enum — admin gets a row per
 *  category whether it's been customized yet or not. */
const ENUM_VALUES = [
  "drinkware",
  "leather_patch",
  "dog_tag",
  "bookmark",
  "zippo",
  "coin",
  "tcg_accessory",
  "phone_case",
  "crystal_engraving",
] as const;

const DEFAULT_DISPLAY_NAME: Record<(typeof ENUM_VALUES)[number], string> = {
  drinkware: "Drinkware",
  leather_patch: "Leather patches",
  dog_tag: "Dog tags",
  bookmark: "Bookmarks",
  zippo: "Zippo lighters",
  coin: "Challenge coins",
  tcg_accessory: "TCG accessories",
  phone_case: "Phone cases",
  crystal_engraving: "Crystal engravings",
};

export default async function AdminCategories() {
  await requireAdmin();

  const stored = await db
    .select()
    .from(productCategories)
    .orderBy(asc(productCategories.sortOrder));

  const byKey = new Map(stored.map((r) => [r.category, r]));

  return (
    <div className="max-w-4xl">
      <header className="mb-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Catalog
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Categories.
        </h1>
        <p className="mt-4 text-sm text-[color:var(--color-ink-800)] max-w-2xl">
          Display metadata for each category. Adding a new category is a dev
          change (the enum drives the decoration method, file pipeline, and AI
          prompt scaffold). Toggle a category&rsquo;s <em>Active</em> off to
          hide it from the public site without archiving its products.
        </p>
      </header>

      <ul className="flex flex-col gap-12">
        {ENUM_VALUES.map((key, idx) => {
          const row = byKey.get(key);
          return (
            <li key={key} className="border-t border-[color:var(--color-paper-300)] pt-8">
              <div className="flex items-baseline justify-between mb-4">
                <h2
                  className="font-display text-2xl"
                  style={{ fontVariationSettings: '"opsz" 28, "wght" 460' }}
                >
                  {DEFAULT_DISPLAY_NAME[key]}
                </h2>
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                  enum: {key}
                </span>
              </div>
              <form action={upsertCategoryAction} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <input type="hidden" name="category" value={key} />
                <div className="md:col-span-5">
                  <Field label="Display name" htmlFor={`name-${key}`} required>
                    <TextInput
                      id={`name-${key}`}
                      name="displayName"
                      required
                      defaultValue={row?.displayName ?? DEFAULT_DISPLAY_NAME[key]}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Sort" htmlFor={`sort-${key}`}>
                    <NumberInput
                      id={`sort-${key}`}
                      name="sortOrder"
                      min={0}
                      defaultValue={row?.sortOrder ?? idx}
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  <Field label="Active" htmlFor={`active-${key}`}>
                    <select
                      id={`active-${key}`}
                      name="isActive"
                      defaultValue={String(row?.isActive ?? true)}
                      className="w-full px-3 py-2 bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] text-[color:var(--color-ink-950)] text-sm focus:outline-none focus:border-[color:var(--color-ink-800)] focus:bg-white transition-colors"
                    >
                      <option value="true">Active</option>
                      <option value="false">Hidden</option>
                    </select>
                  </Field>
                </div>
                <div className="md:col-span-12">
                  <Field
                    label="Blurb"
                    htmlFor={`blurb-${key}`}
                    hint="One short line shown on the home tile and category page header."
                  >
                    <TextArea
                      id={`blurb-${key}`}
                      name="blurb"
                      rows={2}
                      defaultValue={row?.blurb ?? ""}
                    />
                  </Field>
                </div>
                <div className="md:col-span-12">
                  <PrimaryButton type="submit">Save</PrimaryButton>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
