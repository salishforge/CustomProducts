import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import { decorationZones, products, uploadedAssets } from "@/drizzle/schema";
import { getProductBySlug } from "@/lib/queries/catalog";
import { findOpenDraft } from "@/lib/queries/drafts";
import { getSession } from "@/lib/auth";
import { Customizer, type ZoneOverlay } from "@/components/customizer/Customizer";
import { designStateSchema, type DesignState } from "@/lib/parse";
import { zoneGeometrySchema } from "@/lib/parse/admin";

/**
 * Image layers persist only their assetId (the runtime src is stripped before
 * save). To rehydrate them on reopen we resolve each assetId to a servable
 * url: uploads stream through /api/assets/[id]; AI-generation outputs use their
 * external r2_key directly.
 */
async function resolveAssetUrls(
  state: DesignState | null,
): Promise<Record<string, string>> {
  if (!state) return {};
  const assetIds = Object.values(state.zones)
    .flatMap((z) => z.layers)
    .filter((l) => l.kind === "image")
    .map((l) => (l as { assetId: string }).assetId);
  if (assetIds.length === 0) return {};

  const rows = await db
    .select({ id: uploadedAssets.id })
    .from(uploadedAssets)
    .where(inArray(uploadedAssets.id, assetIds));

  // Uploads and generation output are both private R2 objects now, so both are
  // read through the route that signs them. It used to branch on kind because
  // generations pinned Replicate's CDN URL.
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.id] = `/api/assets/${row.id}`;
  }
  return map;
}

/**
 * Load the variant's decoration zones and reduce them to the rect overlays the
 * customizer can draw. Crystal (box_mm) zones have no 2D representation and are
 * dropped here; a malformed geometry row is skipped rather than crashing the
 * page.
 */
async function resolveZoneOverlays(variantId: string): Promise<ZoneOverlay[]> {
  const rows = await db
    .select({
      id: decorationZones.id,
      name: decorationZones.name,
      geometry: decorationZones.geometry,
    })
    .from(decorationZones)
    .where(eq(decorationZones.productVariantId, variantId));

  const overlays: ZoneOverlay[] = [];
  for (const row of rows) {
    const parsed = zoneGeometrySchema.safeParse(row.geometry);
    if (parsed.success && parsed.data.shape === "rect") {
      overlays.push({
        id: row.id,
        name: row.name,
        x: parsed.data.x,
        y: parsed.data.y,
        width: parsed.data.width,
        height: parsed.data.height,
        rotation: parsed.data.rotation,
      });
    }
  }
  return overlays;
}

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.status, "active"));
  return rows.map((r) => ({ slug: r.slug }));
}

export const dynamic = "force-dynamic";

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const variant = product.variants[0];
  if (!variant) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          No variants configured for {product.name}.
        </p>
      </div>
    );
  }

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;
  const draft = await findOpenDraft(customerId, variant.id);

  let initialDesignState: DesignState | null = null;
  if (draft) {
    const parsed = designStateSchema.safeParse(draft.designState);
    if (parsed.success) initialDesignState = parsed.data;
  }

  const assetUrls = await resolveAssetUrls(initialDesignState);
  const zoneOverlays = await resolveZoneOverlays(variant.id);

  return (
    <Customizer
      productName={product.name}
      productSlug={product.slug}
      productVariantId={variant.id}
      initialDesignState={initialDesignState}
      assetUrls={assetUrls}
      zoneOverlays={zoneOverlays}
    />
  );
}
