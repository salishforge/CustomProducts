import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  decorationZones,
  products,
  productVariants,
  type DecorationZone,
} from "@/drizzle/schema";
import {
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import {
  createZoneAction,
  deleteZoneAction,
  updateZoneAction,
} from "../_actions/zones";

export const dynamic = "force-dynamic";

const ZONE_KINDS = ["text_only", "image_only", "mixed", "crystal_volume"];

const DEFAULT_GEOMETRY = {
  shape: "rect",
  x: 160,
  y: 250,
  width: 400,
  height: 400,
  rotation: 0,
};

const DEFAULT_PRINT_SPEC = {
  dpi: 300,
  colorProfile: "sRGB",
  maxWidthMm: null,
  maxHeightMm: null,
  vectorRequired: false,
};

/** Shared name/kind/ordering/geometry/printSpec fields for create + edit. */
function ZoneFields({
  idPrefix,
  zone,
}: {
  idPrefix: string;
  zone?: DecorationZone;
}) {
  const geometry = zone
    ? JSON.stringify(zone.geometry, null, 2)
    : JSON.stringify(DEFAULT_GEOMETRY, null, 2);
  const printSpec = zone
    ? JSON.stringify(zone.printSpec, null, 2)
    : JSON.stringify(DEFAULT_PRINT_SPEC, null, 2);

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_auto] gap-4">
        <Field label="Name" htmlFor={`${idPrefix}-name`} required>
          <TextInput
            id={`${idPrefix}-name`}
            name="name"
            required
            defaultValue={zone?.name ?? ""}
            placeholder="Front face"
          />
        </Field>
        <Field label="Kind" htmlFor={`${idPrefix}-kind`} required>
          <SelectInput
            id={`${idPrefix}-kind`}
            name="kind"
            required
            defaultValue={zone?.kind ?? "mixed"}
          >
            {ZONE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Order" htmlFor={`${idPrefix}-ordering`}>
          <NumberInput
            id={`${idPrefix}-ordering`}
            name="ordering"
            min={0}
            defaultValue={zone?.ordering ?? 0}
            className="w-20"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Geometry (JSON)"
          htmlFor={`${idPrefix}-geometry`}
          hint="rect = canvas frame px (720×900); box_mm = crystal volume"
          required
        >
          <TextArea
            id={`${idPrefix}-geometry`}
            name="geometry"
            rows={8}
            required
            defaultValue={geometry}
            className="font-mono text-xs"
          />
        </Field>
        <Field
          label="Print spec (JSON)"
          htmlFor={`${idPrefix}-printSpec`}
          hint="dpi, colorProfile (sRGB|CMYK|grayscale), max mm, vectorRequired"
          required
        >
          <TextArea
            id={`${idPrefix}-printSpec`}
            name="printSpec"
            rows={8}
            required
            defaultValue={printSpec}
            className="font-mono text-xs"
          />
        </Field>
      </div>
    </>
  );
}

export default async function ProductZonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id));

  const variantIds = variants.map((v) => v.id);
  const zones =
    variantIds.length > 0
      ? await db
          .select()
          .from(decorationZones)
          .where(inArray(decorationZones.productVariantId, variantIds))
      : [];

  const zonesByVariant = new Map<string, DecorationZone[]>();
  for (const z of zones) {
    const list = zonesByVariant.get(z.productVariantId) ?? [];
    list.push(z);
    zonesByVariant.set(z.productVariantId, list);
  }
  for (const list of zonesByVariant.values()) {
    list.sort((a, b) => a.ordering - b.ordering);
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <Link
          href={`/admin/products/${product.id}` as never}
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← {product.name}
        </Link>
        <h1
          className="mt-4 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Decoration zones
        </h1>
        <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-600)]">
          Printable / engravable areas per variant. Rect zones overlay the
          customizer canvas; the print resolver reads each zone&rsquo;s spec.
        </p>
      </header>

      <nav className="border-b border-[color:var(--color-paper-300)] mb-10">
        <ul className="flex gap-8 font-mono text-[0.7rem] uppercase tracking-[0.22em]">
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            <Link
              href={`/admin/products/${product.id}` as never}
              className="hover:text-[color:var(--color-ink-800)] transition-colors"
            >
              Details &amp; variants
            </Link>
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            <Link
              href={`/admin/products/${product.id}/images` as never}
              className="hover:text-[color:var(--color-ink-800)] transition-colors"
            >
              Images
            </Link>
          </li>
          <li className="pb-3 border-b-2 border-[color:var(--color-ink-950)] -mb-px text-[color:var(--color-ink-950)]">
            Decoration zones
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            Mock-up <span className="ml-2 text-[0.6rem]">soon</span>
          </li>
        </ul>
      </nav>

      {variants.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-600)]">
          This product has no variants yet. Zones attach to a variant — add one
          on the{" "}
          <Link
            href={`/admin/products/${product.id}` as never}
            className="underline"
          >
            details tab
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="flex flex-col gap-16">
          {variants.map((variant) => {
            const variantZones = zonesByVariant.get(variant.id) ?? [];
            return (
              <section key={variant.id}>
                <div className="mb-6 flex items-baseline gap-3">
                  <h2
                    className="font-display text-2xl"
                    style={{ fontVariationSettings: '"opsz" 28, "wght" 440' }}
                  >
                    {variant.name}
                  </h2>
                  <span className="font-mono text-xs text-[color:var(--color-ink-600)]">
                    {variant.sku} · {variantZones.length} zone
                    {variantZones.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex flex-col gap-8">
                  {variantZones.map((zone) => (
                    <div
                      key={zone.id}
                      className="border border-[color:var(--color-paper-300)] p-5"
                    >
                      <form action={updateZoneAction} className="flex flex-col gap-5">
                        <input type="hidden" name="id" value={zone.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <ZoneFields idPrefix={`zone-${zone.id}`} zone={zone} />
                        <div className="flex items-center gap-3">
                          <PrimaryButton type="submit">Save zone</PrimaryButton>
                        </div>
                      </form>
                      <form
                        action={deleteZoneAction}
                        className="mt-4 pt-4 border-t border-[color:var(--color-paper-200)]"
                      >
                        <input type="hidden" name="id" value={zone.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <SecondaryButton type="submit">Delete zone</SecondaryButton>
                      </form>
                    </div>
                  ))}

                  <details className="border border-dashed border-[color:var(--color-paper-300)] p-5">
                    <summary className="cursor-pointer font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)]">
                      + New zone for {variant.name}
                    </summary>
                    <form
                      action={createZoneAction}
                      className="mt-5 flex flex-col gap-5"
                    >
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="productVariantId"
                        value={variant.id}
                      />
                      <ZoneFields idPrefix={`new-${variant.id}`} />
                      <div className="flex items-center gap-3">
                        <PrimaryButton type="submit">Add zone</PrimaryButton>
                      </div>
                    </form>
                  </details>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
