/*
 * Catalog read queries.
 *
 * Every customer-facing page that reads product / category / featured-product
 * data goes through this module. Each query is wrapped in `unstable_cache`
 * keyed by tag so admin Server Actions can invalidate atomically via
 * `revalidateTag('products' | 'categories' | 'featured')`.
 *
 * Customer routes read exclusively through this module — no seed-file
 * fallback. The data lives in Postgres; the dev seed in `lib/db/seed.ts`
 * is idempotent and populates a baseline catalog on first run.
 */

import { unstable_cache } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  productCategories,
  productImages,
  products,
  productVariants,
  featuredProducts,
  type FeaturedProduct,
  type Product,
  type ProductCategoryRow,
  type ProductVariant,
} from "@/drizzle/schema";

export type CatalogProduct = Product & {
  variants: ProductVariant[];
  heroImage: { cloudflareImageId: string; altText: string | null } | null;
};

export const getActiveProducts = unstable_cache(
  async (): Promise<CatalogProduct[]> => {
    const rows = await db
      .select({
        product: products,
        variant: productVariants,
        heroImage: productImages,
      })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(productImages, eq(productImages.id, products.heroImageId))
      .where(eq(products.status, "active"))
      .orderBy(asc(products.name));

    const byId = new Map<string, CatalogProduct>();
    for (const row of rows) {
      const p = row.product;
      let entry = byId.get(p.id);
      if (!entry) {
        entry = {
          ...p,
          variants: [],
          heroImage: row.heroImage
            ? {
                cloudflareImageId: row.heroImage.cloudflareImageId,
                altText: row.heroImage.altText,
              }
            : null,
        };
        byId.set(p.id, entry);
      }
      if (row.variant) entry.variants.push(row.variant);
    }
    return Array.from(byId.values());
  },
  ["catalog", "active-products"],
  { tags: ["products"], revalidate: 60 },
);

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<CatalogProduct | null> => {
    const rows = await db
      .select({
        product: products,
        variant: productVariants,
        heroImage: productImages,
      })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(productImages, eq(productImages.id, products.heroImageId))
      .where(and(eq(products.slug, slug), eq(products.status, "active")));

    const first = rows[0];
    if (!first) return null;
    const result: CatalogProduct = {
      ...first.product,
      variants: [],
      heroImage: first.heroImage
        ? {
            cloudflareImageId: first.heroImage.cloudflareImageId,
            altText: first.heroImage.altText,
          }
        : null,
    };
    for (const row of rows) {
      if (row.variant) result.variants.push(row.variant);
    }
    return result;
  },
  ["catalog", "product-by-slug"],
  { tags: ["products"], revalidate: 60 },
);

export type CategoryWithStock = ProductCategoryRow & {
  productCount: number;
};

export const getActiveCategoriesWithStock = unstable_cache(
  async (): Promise<CategoryWithStock[]> => {
    const rows = await db
      .select({
        category: productCategories,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(productCategories)
      .leftJoin(
        products,
        and(
          eq(products.category, productCategories.category),
          eq(products.status, "active"),
        ),
      )
      .where(eq(productCategories.isActive, true))
      .groupBy(productCategories.category)
      .having(sql`count(${products.id}) >= 1`)
      .orderBy(asc(productCategories.sortOrder));

    return rows.map((r) => ({ ...r.category, productCount: r.productCount }));
  },
  ["catalog", "categories-with-stock"],
  { tags: ["categories", "products"], revalidate: 60 },
);

export type FeaturedSlot = "home_hero" | "home_secondary" | "made_this_week";

export const getFeaturedForSlot = unstable_cache(
  async (
    slot: FeaturedSlot,
  ): Promise<Array<{ featured: FeaturedProduct; product: CatalogProduct }>> => {
    const rows = await db
      .select({
        featured: featuredProducts,
        product: products,
        variant: productVariants,
      })
      .from(featuredProducts)
      .innerJoin(products, eq(products.id, featuredProducts.productId))
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(featuredProducts.slot, slot),
          eq(products.status, "active"),
        ),
      )
      .orderBy(asc(featuredProducts.sortOrder));

    const now = Date.now();
    const byProductId = new Map<
      string,
      { featured: FeaturedProduct; product: CatalogProduct }
    >();
    for (const r of rows) {
      const start = r.featured.startsAt?.getTime() ?? -Infinity;
      const end = r.featured.endsAt?.getTime() ?? Infinity;
      if (start > now || now > end) continue;

      let entry = byProductId.get(r.product.id);
      if (!entry) {
        entry = {
          featured: r.featured,
          product: { ...r.product, variants: [], heroImage: null },
        };
        byProductId.set(r.product.id, entry);
      }
      if (r.variant) entry.product.variants.push(r.variant);
    }
    return Array.from(byProductId.values());
  },
  ["catalog", "featured-by-slot"],
  { tags: ["featured", "products"], revalidate: 60 },
);
