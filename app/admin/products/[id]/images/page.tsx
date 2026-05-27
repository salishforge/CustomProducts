import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { productImages, products } from "@/drizzle/schema";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { imageUrl } from "@/lib/cloudflare-images/client";
import { SecondaryButton } from "@/components/admin/Field";

import {
  deleteImageAction,
  setHeroImageAction,
} from "../_actions/images";

export const dynamic = "force-dynamic";

export default async function ProductImagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) notFound();

  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.ordering));

  const cfConfigured = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_IMAGES_API_TOKEN,
  );

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
          Images.
        </h1>
      </header>

      <nav className="border-b border-[color:var(--color-paper-300)] mb-10">
        <ul className="flex gap-8 font-mono text-[0.7rem] uppercase tracking-[0.22em]">
          <li className="pb-3">
            <Link
              href={`/admin/products/${product.id}` as never}
              className="text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-800)] transition-colors"
            >
              Details &amp; variants
            </Link>
          </li>
          <li className="pb-3 border-b-2 border-[color:var(--color-ink-950)] -mb-px text-[color:var(--color-ink-950)]">
            Images
          </li>
        </ul>
      </nav>

      {!cfConfigured ? (
        <div className="mb-10 p-4 border border-[color:var(--color-ember-500)]/40 bg-[color:var(--color-ember-300)]/10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ember-700)]">
            Cloudflare Images not configured
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-ink-800)]">
            Set <code className="font-mono text-xs">CLOUDFLARE_ACCOUNT_ID</code>,{" "}
            <code className="font-mono text-xs">CLOUDFLARE_IMAGES_API_TOKEN</code>, and{" "}
            <code className="font-mono text-xs">CLOUDFLARE_IMAGES_DELIVERY_DOMAIN</code>{" "}
            in <code className="font-mono text-xs">.env.local</code>. Until then, uploads will return an error and product pages render placeholder tiles.
          </p>
        </div>
      ) : null}

      <section className="mb-12">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Upload
        </h2>
        <ImageUploader
          productId={product.id}
          defaultKind={images.length === 0 ? "hero" : "gallery"}
          defaultSetAsHero={images.length === 0}
        />
      </section>

      <section>
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Existing images
          <span className="ml-3 nums-tabular">{images.length}</span>
        </h2>
        {images.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-600)]">
            None yet. Uploads land here.
          </p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {images.map((img) => {
              const isHero = product.heroImageId === img.id;
              return (
                <li
                  key={img.id}
                  className="flex flex-col gap-2 p-3 border border-[color:var(--color-paper-300)]"
                >
                  <div className="aspect-[4/5] bg-[color:var(--color-paper-200)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(img.cloudflareImageId, "public")}
                      alt={img.altText ?? ""}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                      {img.kind}
                      {isHero ? " · hero" : ""}
                    </span>
                    <span className="font-mono text-[0.6rem] text-[color:var(--color-ink-400)] nums-tabular">
                      #{img.ordering}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {!isHero ? (
                      <form action={setHeroImageAction} className="flex-1">
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="imageId" value={img.id} />
                        <button
                          type="submit"
                          className="w-full font-mono text-[0.6rem] uppercase tracking-[0.18em] py-1.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] transition-colors"
                        >
                          Set as hero
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteImageAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="imageId" value={img.id} />
                      <SecondaryButton type="submit" className="!py-1.5 !text-[0.6rem]">
                        Delete
                      </SecondaryButton>
                    </form>
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
