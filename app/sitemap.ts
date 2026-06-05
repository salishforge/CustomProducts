import { eq } from "drizzle-orm";
import type { MetadataRoute } from "next";

import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://salishforge.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const productRows = await db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.status, "active"));

  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${APP_URL}/products`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${APP_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...productRows.map((p) => ({
      url: `${APP_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
