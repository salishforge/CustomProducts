"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { newId } from "@/lib/db/id";
import type { DesignState, Layer } from "@/lib/parse";

import {
  generateForCustomizerAction,
  pollGenerationStatusAction,
  saveDesignDraftAction,
} from "@/app/customize/[slug]/_actions/customizer";

/*
 * MVP customizer.
 *
 * Konva stage (lazy-loaded; react-konva is browser-only). Single zone called
 * 'main'. Layer model: text + image. AI generations land as image layers
 * whose `assetId` references the uploaded_assets row written by the Replicate
 * webhook.
 *
 * Deferred to a later pass per the plan:
 *   - decoration-zone magnetism + snap-to guides
 *   - undo/redo tree
 *   - WebGL2 shader-warped mock-up preview
 *   - virtualized font catalog (here: a small hand-picked set)
 *   - mobile bottom-sheets
 *   - mask-based regeneration
 *   - automatic background removal
 *   - browser file upload (needs R2 presign)
 */

const STAGE_WIDTH = 720;
const STAGE_HEIGHT = 900;

const FONTS = [
  { label: "Fraunces (display)", family: "var(--font-fraunces)" },
  { label: "Inter Tight (sans)", family: "var(--font-inter-tight)" },
  { label: "JetBrains Mono", family: "var(--font-jetbrains-mono)" },
];

type TextLayer = Extract<Layer, { kind: "text" }>;
type ImageLayer = Extract<Layer, { kind: "image" }>;

type ImageRuntime = ImageLayer & { _src?: string; _img?: HTMLImageElement };
type RuntimeLayer = TextLayer | ImageRuntime;

// Lazy-load the Konva stage — react-konva requires a window object so it
// cannot be evaluated during SSR.
const StageView = dynamic(() => import("./StageView"), { ssr: false });

export function Customizer({
  productName,
  productSlug,
  productVariantId,
  initialDesignState,
}: {
  productName: string;
  productSlug: string;
  productVariantId: string;
  initialDesignState: DesignState | null;
}) {
  const [layers, setLayers] = useState<RuntimeLayer[]>(() => {
    const fromInitial = initialDesignState?.zones?.main?.layers ?? [];
    return fromInitial as RuntimeLayer[];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<
    "idle" | "queued" | "running" | "succeeded" | "failed"
  >("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const pollingRef = useRef<number | null>(null);

  const selected = useMemo(
    () => layers.find((l) => l.id === selectedId) ?? null,
    [layers, selectedId],
  );

  // Resolve image src for AI layers — point at the uploaded_assets.r2Key the
  // webhook wrote (Replicate delivery URL in interim mode).
  useEffect(() => {
    let cancelled = false;
    async function hydrateImages() {
      const next = await Promise.all(
        layers.map(async (l) => {
          if (l.kind !== "image" || (l as ImageRuntime)._img) return l;
          const r = l as ImageRuntime;
          if (!r._src) return r;
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`image load failed: ${r._src}`));
            img.src = r._src!;
          });
          return { ...r, _img: img };
        }),
      );
      if (!cancelled) setLayers(next as RuntimeLayer[]);
    }
    hydrateImages().catch((err) => console.warn(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.map((l) => l.id + ((l as ImageRuntime)._src ?? "")).join("|")]);

  // --- Layer operations ---------------------------------------------------

  const addText = useCallback(() => {
    const id = newId();
    const layer: TextLayer = {
      kind: "text",
      id,
      content: "Your text",
      fontFamily: FONTS[0]!.family,
      fontWeight: 460,
      fontSize: 64,
      color: "#1a1410",
      transform: {
        x: STAGE_WIDTH / 2 - 150,
        y: STAGE_HEIGHT / 2 - 40,
        width: 300,
        height: 80,
        rotation: 0,
      },
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(id);
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<RuntimeLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? ({ ...l, ...patch } as RuntimeLayer) : l)),
    );
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  // --- AI generation -----------------------------------------------------

  const cancelPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startGeneration = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiError(null);
    setAiStatus("queued");

    const result = await generateForCustomizerAction({
      prompt: aiPrompt,
      productVariantId,
      zoneId: "main",
    });
    if (!result.ok) {
      setAiStatus("failed");
      setAiError(result.reason + (result.detail ? `: ${result.detail}` : ""));
      return;
    }

    setAiStatus("running");
    const generationId = result.generationId;

    cancelPolling();
    pollingRef.current = window.setInterval(async () => {
      const status = await pollGenerationStatusAction(generationId);
      if (!status) return;
      if (status.status === "succeeded") {
        cancelPolling();
        setAiStatus("succeeded");
        const id = newId();
        const layer: ImageRuntime = {
          kind: "image",
          id,
          assetId: status.assetId,
          _src: status.assetUrl,
          transform: {
            x: STAGE_WIDTH / 2 - 200,
            y: STAGE_HEIGHT / 2 - 200,
            width: 400,
            height: 400,
            rotation: 0,
          },
        };
        setLayers((prev) => [...prev, layer]);
        setSelectedId(id);
        setAiPrompt("");
        setTimeout(() => setAiStatus("idle"), 1200);
      } else if (status.status === "failed" || status.status === "cancelled") {
        cancelPolling();
        setAiStatus("failed");
        setAiError(("error" in status && status.error) || "generation failed");
      }
    }, 2000) as unknown as number;
  }, [aiPrompt, productVariantId, cancelPolling]);

  useEffect(() => cancelPolling, [cancelPolling]);

  // --- Save / Add to cart ------------------------------------------------

  const buildDesignState = useCallback((): DesignState => {
    const stripped = layers.map(({ ...rest }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = rest as any;
      delete r._img;
      delete r._src;
      return r as Layer;
    });
    return { zones: { main: { layers: stripped } } };
  }, [layers]);

  const save = useCallback(async () => {
    setSavingState("saving");
    const res = await saveDesignDraftAction({
      productVariantId,
      designState: buildDesignState(),
    });
    if (res.ok) {
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 1500);
    } else {
      setSavingState("idle");
      console.warn("save failed", res.reason);
    }
  }, [productVariantId, buildDesignState]);

  // --- Render ------------------------------------------------------------

  return (
    <div className="grid grid-cols-[260px_1fr_320px] min-h-dvh">
      {/* LEFT — layer list */}
      <aside className="border-r border-[color:var(--color-paper-300)]/60 bg-[color:var(--color-paper-100)] p-5 flex flex-col gap-5 sticky top-0 h-dvh overflow-y-auto">
        <Link
          href={`/products/${productSlug}` as never}
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← {productName}
        </Link>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={addText}
            className="w-full inline-flex items-center justify-between px-4 py-2.5 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
          >
            + Text
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] pb-2">
            Layers
          </p>
          {layers.length === 0 ? (
            <p className="text-xs text-[color:var(--color-ink-400)]">
              Nothing yet. Add a text layer or generate an image.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {[...layers].reverse().map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full text-left px-2 py-1.5 text-xs flex items-baseline justify-between transition-colors ${
                      selectedId === l.id
                        ? "bg-[color:var(--color-paper-200)] text-[color:var(--color-ink-950)]"
                        : "text-[color:var(--color-ink-800)] hover:bg-[color:var(--color-paper-200)]/60"
                    }`}
                  >
                    <span className="truncate">
                      {l.kind === "text"
                        ? `"${(l as TextLayer).content.slice(0, 20)}"`
                        : "AI image"}
                    </span>
                    <span className="font-mono text-[0.6rem] text-[color:var(--color-ink-400)] uppercase ml-2">
                      {l.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={save}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] font-mono text-xs uppercase tracking-[0.22em] transition-colors"
          >
            {savingState === "saving" ? "Saving…" : savingState === "saved" ? "Saved ✓" : "Save design"}
          </button>
        </div>
      </aside>

      {/* CENTER — stage */}
      <main className="flex items-center justify-center p-8 bg-[color:var(--color-paper-50)]">
        <div className="surface-noise hairline shadow-sm" style={{ width: STAGE_WIDTH * 0.8, height: STAGE_HEIGHT * 0.8 }}>
          <StageView
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={updateLayer}
          />
        </div>
      </main>

      {/* RIGHT — properties + AI panel */}
      <aside className="border-l border-[color:var(--color-paper-300)]/60 bg-[color:var(--color-paper-100)] p-5 flex flex-col gap-6 sticky top-0 h-dvh overflow-y-auto">
        {selected ? (
          <PropertiesPanel
            layer={selected}
            onChange={(p) => updateLayer(selected.id, p as Partial<RuntimeLayer>)}
            onDelete={() => deleteLayer(selected.id)}
          />
        ) : (
          <p className="text-xs text-[color:var(--color-ink-400)]">
            Select a layer to edit its properties.
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-[color:var(--color-paper-300)]">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            Generate with AI
          </p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={`A dragon for a ${productName.toLowerCase()}…`}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] focus:outline-none focus:border-[color:var(--color-ink-800)]"
            disabled={aiStatus === "running" || aiStatus === "queued"}
          />
          <button
            type="button"
            onClick={startGeneration}
            disabled={!aiPrompt.trim() || aiStatus === "running" || aiStatus === "queued"}
            className="inline-flex items-center justify-between px-4 py-2.5 bg-[color:var(--color-ember-700)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiStatus === "queued" || aiStatus === "running"
              ? "Generating…"
              : aiStatus === "succeeded"
                ? "Done ✓"
                : "Generate"}
            <span aria-hidden>~12s</span>
          </button>
          {aiError ? (
            <p className="text-xs text-[color:var(--color-ember-700)]">{aiError}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

// --- Properties panel ------------------------------------------------------

function PropertiesPanel({
  layer,
  onChange,
  onDelete,
}: {
  layer: RuntimeLayer;
  onChange: (patch: Partial<Layer>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          {layer.kind} layer
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ember-700)] hover:text-[color:var(--color-ember-900)] transition-colors"
        >
          Delete
        </button>
      </div>

      {layer.kind === "text" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              Content
            </span>
            <textarea
              value={layer.content}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] focus:outline-none focus:border-[color:var(--color-ink-800)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              Font
            </span>
            <select
              value={layer.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] focus:outline-none focus:border-[color:var(--color-ink-800)]"
            >
              {FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Size
              </span>
              <input
                type="number"
                min={8}
                max={256}
                value={layer.fontSize}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] focus:outline-none focus:border-[color:var(--color-ink-800)] nums-tabular"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Color
              </span>
              <input
                type="color"
                value={layer.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-full h-10 bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] cursor-pointer"
              />
            </label>
          </div>
        </>
      ) : null}

      {layer.kind === "image" ? (
        <p className="text-xs text-[color:var(--color-ink-600)]">
          AI image · drag handles on the stage to resize and rotate.
        </p>
      ) : null}
    </div>
  );
}
