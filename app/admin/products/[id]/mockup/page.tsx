import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  decorationZones,
  mockupTemplates,
  products,
  productImages,
  productVariants,
  type DecorationZone,
  type MockupTemplate,
  type ProductImage,
} from "@/drizzle/schema";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import {
  createMockupTemplateAction,
  deleteMockupTemplateAction,
  updateMockupTemplateAction,
} from "../_actions/mockup";

export const dynamic = "force-dynamic";

const FORMATS = ["2d_overlay", "3d_r3f"];

/** A blank overlay config seeded with the variant's first zone id when known. */
function defaultOverlayConfig(zoneId: string | undefined): string {
  return JSON.stringify(
    {
      baseWidth: 1200,
      baseHeight: 1200,
      zones: [
        {
          zoneId: zoneId ?? "REPLACE_WITH_ZONE_ID",
          corners: {
            tl: [360, 360],
            tr: [840, 360],
            br: [840, 840],
            bl: [360, 840],
          },
          opacity: 1,
          blendMode: "multiply",
        },
      ],
      shadowMaskImageId: null,
      highlightMaskImageId: null,
    },
    null,
    2,
  );
}

/** Shared format/base-image/overlay/model fields for create + edit. */
function MockupFields({
  idPrefix,
  images,
  zones,
  template,
}: {
  idPrefix: string;
  images: ProductImage[];
  zones: DecorationZone[];
  template?: MockupTemplate;
}) {
  const overlay = template
    ? JSON.stringify(template.overlayConfig, null, 2)
    : defaultOverlayConfig(zones[0]?.id);
  const zoneHint =
    zones.length > 0
      ? `Zone ids: ${zones.map((z) => `${z.name} → ${z.id}`).join(" · ")}`
      : "This variant has no decoration zones yet — add zones first so the overlay has something to map.";

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Format" htmlFor={`${idPrefix}-format`} required>
          <SelectInput
            id={`${idPrefix}-format`}
            name="format"
            required
            defaultValue={template?.format ?? "2d_overlay"}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label="Base image"
          htmlFor={`${idPrefix}-baseImageId`}
          hint="The product photo the art is composited onto (2D overlay)."
        >
          <SelectInput
            id={`${idPrefix}-baseImageId`}
            name="baseImageId"
            defaultValue={template?.baseImageId ?? ""}
          >
            <option value="">— none —</option>
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.kind} · …{img.id.slice(-6)}
                {img.altText ? ` · ${img.altText}` : ""}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field
        label="Overlay config (JSON)"
        htmlFor={`${idPrefix}-overlayConfig`}
        hint={zoneHint}
        required
      >
        <TextArea
          id={`${idPrefix}-overlayConfig`}
          name="overlayConfig"
          rows={14}
          required
          defaultValue={overlay}
          className="font-mono text-xs"
        />
      </Field>

      <Field
        label="3D model URL"
        htmlFor={`${idPrefix}-r3fModelUrl`}
        hint="Only for format 3d_r3f — an R2 URL to the GLB model."
      >
        <TextInput
          id={`${idPrefix}-r3fModelUrl`}
          name="r3fModelUrl"
          type="url"
          defaultValue={template?.r3fModelUrl ?? ""}
          placeholder="https://…/model.glb"
        />
      </Field>
    </>
  );
}

export default async function ProductMockupPage({
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

  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id));

  const templates =
    variantIds.length > 0
      ? await db
          .select()
          .from(mockupTemplates)
          .where(inArray(mockupTemplates.variantId, variantIds))
      : [];

  const zones =
    variantIds.length > 0
      ? await db
          .select()
          .from(decorationZones)
          .where(inArray(decorationZones.productVariantId, variantIds))
      : [];

  // A variant carries at most one mock-up template (product_variants holds a
  // singular mockup_template_id), so index the first template per variant.
  const templateByVariant = new Map<string, MockupTemplate>();
  for (const t of templates) {
    if (t.variantId && !templateByVariant.has(t.variantId)) {
      templateByVariant.set(t.variantId, t);
    }
  }

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
          Mock-up templates
        </h1>
        <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-600)]">
          How each variant&rsquo;s decoration zones project onto its product
          photo. 2D overlays map zone art onto a destination quad in the base
          image; 3D templates point at a GLB model.
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
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            <Link
              href={`/admin/products/${product.id}/zones` as never}
              className="hover:text-[color:var(--color-ink-800)] transition-colors"
            >
              Decoration zones
            </Link>
          </li>
          <li className="pb-3 border-b-2 border-[color:var(--color-ink-950)] -mb-px text-[color:var(--color-ink-950)]">
            Mock-up
          </li>
        </ul>
      </nav>

      {variants.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-600)]">
          This product has no variants yet. Templates attach to a variant — add
          one on the{" "}
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
            const template = templateByVariant.get(variant.id);
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
                    {variant.sku} ·{" "}
                    {template ? `${template.format}` : "no template yet"}
                  </span>
                </div>

                {template ? (
                  <div className="border border-[color:var(--color-paper-300)] p-5">
                    <form
                      action={updateMockupTemplateAction}
                      className="flex flex-col gap-5"
                    >
                      <input type="hidden" name="id" value={template.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="variantId"
                        value={variant.id}
                      />
                      <MockupFields
                        idPrefix={`tpl-${template.id}`}
                        images={images}
                        zones={variantZones}
                        template={template}
                      />
                      <div className="flex items-center gap-3">
                        <PrimaryButton type="submit">
                          Save template
                        </PrimaryButton>
                      </div>
                    </form>
                    <form
                      action={deleteMockupTemplateAction}
                      className="mt-4 pt-4 border-t border-[color:var(--color-paper-200)]"
                    >
                      <input type="hidden" name="id" value={template.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <SecondaryButton type="submit">
                        Delete template
                      </SecondaryButton>
                    </form>
                  </div>
                ) : (
                  <div className="border border-dashed border-[color:var(--color-paper-300)] p-5">
                    <form
                      action={createMockupTemplateAction}
                      className="flex flex-col gap-5"
                    >
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="hidden"
                        name="variantId"
                        value={variant.id}
                      />
                      <MockupFields
                        idPrefix={`new-${variant.id}`}
                        images={images}
                        zones={variantZones}
                      />
                      <div className="flex items-center gap-3">
                        <PrimaryButton type="submit">
                          Add template
                        </PrimaryButton>
                      </div>
                    </form>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
