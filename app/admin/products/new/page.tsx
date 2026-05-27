import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import {
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import { createProductAction } from "../_actions/products";

const CATEGORIES = [
  { value: "drinkware", label: "Drinkware" },
  { value: "leather_patch", label: "Leather patch" },
  { value: "dog_tag", label: "Dog tag" },
  { value: "bookmark", label: "Bookmark" },
  { value: "zippo", label: "Zippo" },
  { value: "coin", label: "Coin" },
  { value: "tcg_accessory", label: "TCG accessory" },
  { value: "phone_case", label: "Phone case" },
  { value: "crystal_engraving", label: "Crystal engraving" },
];

const METHODS = [
  { value: "laser", label: "Laser engrave" },
  { value: "uv_print", label: "UV print" },
  { value: "crystal_engrave", label: "Crystal engrave" },
  { value: "dye_sub", label: "Dye sublimation" },
];

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl">
      <header className="mb-10">
        <Link
          href="/admin/products"
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Products
        </Link>
        <h1
          className="mt-4 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          New product.
        </h1>
      </header>

      <form action={createProductAction} className="flex flex-col gap-6">
        <Field label="Name" htmlFor="name" required>
          <TextInput id="name" name="name" required placeholder="Crystal cube" />
        </Field>

        <Field
          label="Slug"
          htmlFor="slug"
          hint="URL-safe: lowercase, hyphens. /products/crystal-cube-80"
          required
        >
          <TextInput
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="crystal-cube-80"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" htmlFor="category" required>
            <SelectInput id="category" name="category" required>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Decoration method" htmlFor="decorationMethod" required>
            <SelectInput id="decorationMethod" name="decorationMethod" required>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Base price (cents)"
            htmlFor="basePriceCents"
            hint="USD cents. $34 = 3400."
            required
          >
            <NumberInput
              id="basePriceCents"
              name="basePriceCents"
              required
              min={0}
              step={100}
              placeholder="3400"
            />
          </Field>
          <Field label="Lead time (days)" htmlFor="leadTimeDays" required>
            <NumberInput
              id="leadTimeDays"
              name="leadTimeDays"
              required
              min={1}
              max={120}
              defaultValue={7}
            />
          </Field>
        </div>

        <Field label="Status" htmlFor="status">
          <SelectInput id="status" name="status" defaultValue="draft">
            <option value="draft">Draft — not visible on site</option>
            <option value="active">Active — live on site</option>
            <option value="archived">Archived — hidden from site, kept for orders</option>
          </SelectInput>
        </Field>

        <Field
          label="Description (MDX)"
          htmlFor="descriptionMdx"
          hint="Markdown supported. Shown on the product detail page."
        >
          <TextArea id="descriptionMdx" name="descriptionMdx" rows={6} />
        </Field>

        <div className="flex items-center gap-3 pt-4">
          <PrimaryButton type="submit">Create product</PrimaryButton>
          <Link href="/admin/products">
            <SecondaryButton type="button">Cancel</SecondaryButton>
          </Link>
        </div>
      </form>
    </div>
  );
}
