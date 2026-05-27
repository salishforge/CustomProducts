"use client";

import { useCallback, useState, useTransition } from "react";

import {
  attachImageAction,
  requestImageUploadAction,
} from "@/app/admin/products/[id]/_actions/images";

/*
 * Client uploader for Cloudflare Images.
 *
 * Three-step flow: request a one-time upload URL via Server Action, POST the
 * file bytes directly to Cloudflare (so the bytes never round-trip through
 * Next), then call a confirm Server Action that inserts the product_images
 * row. Configuration errors (missing CF env) surface as a visible message.
 */

type Kind = "hero" | "gallery" | "mockup_base" | "swatch" | "process" | "macro";

export function ImageUploader({
  productId,
  defaultKind = "gallery",
  defaultSetAsHero = false,
}: {
  productId: string;
  defaultKind?: Kind;
  defaultSetAsHero?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [setAsHero, setSetAsHero] = useState(defaultSetAsHero);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setProgress(`Uploading ${files.length} file(s)…`);
      try {
        for (const file of Array.from(files)) {
          // 1. Server requests a direct-upload URL from CF.
          const { uploadURL, cfImageId } = await requestImageUploadAction(
            productId,
            kind,
          );
          // 2. Browser uploads the bytes directly to CF.
          const fd = new FormData();
          fd.append("file", file);
          const cfRes = await fetch(uploadURL, { method: "POST", body: fd });
          if (!cfRes.ok) {
            throw new Error(`Cloudflare upload failed (${cfRes.status})`);
          }
          // 3. Server attaches the resulting id to the product row.
          await attachImageAction({
            productId,
            cfImageId,
            kind,
            altText: file.name,
            setAsHero,
          });
        }
        setProgress("Done.");
        startTransition(() => {
          // Server action's revalidatePath refreshes the parent route's data.
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setProgress(null);
      }
    },
    [productId, kind, setAsHero],
  );

  const [isDragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            Kind
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="w-full px-3 py-2 bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] text-sm focus:outline-none focus:border-[color:var(--color-ink-800)]"
          >
            <option value="hero">hero</option>
            <option value="gallery">gallery</option>
            <option value="process">process</option>
            <option value="macro">macro</option>
            <option value="mockup_base">mockup_base</option>
            <option value="swatch">swatch</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={setAsHero}
            onChange={(e) => setSetAsHero(e.target.checked)}
          />
          Set as product hero
        </label>
      </div>

      <label
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 px-6 py-12 border-2 border-dashed cursor-pointer transition-colors ${
          isDragging
            ? "border-[color:var(--color-ember-500)] bg-[color:var(--color-ember-300)]/10"
            : "border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)]"
        }`}
      >
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Drop images here or click to choose
        </p>
        <p className="text-xs text-[color:var(--color-ink-400)]">
          JPEG, PNG, WebP, AVIF · Up to 10 MB each
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          multiple
          className="sr-only"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>

      {progress ? (
        <p className="font-mono text-xs text-[color:var(--color-ink-600)]">{progress}{pending ? "…" : ""}</p>
      ) : null}
      {error ? (
        <p className="font-mono text-xs text-[color:var(--color-ember-700)]">{error}</p>
      ) : null}
    </div>
  );
}
