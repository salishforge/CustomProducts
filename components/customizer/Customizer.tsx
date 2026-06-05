"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { newId } from "@/lib/db/id";
import type { DesignState, Layer } from "@/lib/parse";
import { SNAP_VH, resolveSnap, cycleSnap, type SnapLevel } from "./sheet-snap";

import {
  generateForCustomizerAction,
  pollGenerationStatusAction,
  saveDesignDraftAction,
  uploadCustomizerImageAction,
} from "@/app/customize/[slug]/_actions/customizer";

/*
 * Customizer (Phase 2b polish).
 *
 * Adds:
 *   - Undo/redo (stack, capped at 50)
 *   - Snap-to-guides at canvas center + edges (6 px threshold)
 *   - Layer ops: duplicate, lock, hide, reorder (move up/down)
 *   - Keyboard shortcuts: cmd/ctrl-Z, cmd/ctrl-shift-Z, cmd/ctrl-D, Delete,
 *     Backspace, Escape (deselect)
 *   - Debounced auto-save (1500 ms after last change) — silent in normal
 *     operation, surfaces only when it fails
 *   - Responsive stage scale (the canvas fits the viewport, not vice-versa)
 *   - Mobile bottom-sheets: below lg the two rails collapse into draggable
 *     sheets snapping to 12/48/92 dvh, launched from a bottom tab bar
 *
 * Deferred per plan (Phase 2b proper):
 *   - Decoration-zone magnetism (visual zone overlay arrives with the
 *     admin zone editor)
 *   - Undo-as-tree (current implementation is a stack)
 *   - WebGL2 shader mock-up preview
 *   - Virtualized font catalog
 *   - Edge-swipe to open the rails (tab-bar launcher ships now)
 *   - Mask-based regeneration
 *   - In-browser background removal
 *   - R2 image upload
 */

const STAGE_WIDTH = 720;
const STAGE_HEIGHT = 900;
const STAGE_DISPLAY_SCALE = 0.8;
const SNAP_THRESHOLD = 6;
const MAX_HISTORY = 50;
const AUTOSAVE_DELAY_MS = 1500;

const FONTS = [
  { label: "Fraunces (display)", family: "var(--font-fraunces)" },
  { label: "Inter Tight (sans)", family: "var(--font-inter-tight)" },
  { label: "JetBrains Mono", family: "var(--font-jetbrains-mono)" },
];

type TextLayer = Extract<Layer, { kind: "text" }>;
type ImageLayer = Extract<Layer, { kind: "image" }>;

type ImageRuntime = ImageLayer & {
  _src?: string;
  _img?: HTMLImageElement;
  _locked?: boolean;
  _hidden?: boolean;
};
type TextRuntime = TextLayer & { _locked?: boolean; _hidden?: boolean };
export type RuntimeLayer = TextRuntime | ImageRuntime;

const StageView = dynamic(() => import("./StageView"), { ssr: false });

// --- Undo stack reducer ----------------------------------------------------

type LayersAction =
  | { type: "set"; layers: RuntimeLayer[]; markHistory?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; layers: RuntimeLayer[] };

type LayersState = {
  layers: RuntimeLayer[];
  past: RuntimeLayer[][];
  future: RuntimeLayer[][];
};

function layersReducer(state: LayersState, action: LayersAction): LayersState {
  switch (action.type) {
    case "set": {
      if (!action.markHistory) {
        // Live updates (drag in progress, slider tweaks) do not push history.
        return { ...state, layers: action.layers };
      }
      const past = [...state.past, state.layers].slice(-MAX_HISTORY);
      return { layers: action.layers, past, future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      const past = state.past.slice(0, -1);
      return { layers: previous, past, future: [state.layers, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...future] = state.future;
      const past = [...state.past, state.layers].slice(-MAX_HISTORY);
      return { layers: next!, past, future };
    }
    case "reset":
      return { layers: action.layers, past: [], future: [] };
  }
}

// --- Public component ------------------------------------------------------

/** A rect decoration zone in the canonical canvas frame, drawn as a boundary
 *  overlay so customers see where art must land. Crystal (box_mm) zones have
 *  no 2D overlay and are filtered out before reaching the stage. */
export type ZoneOverlay = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export function Customizer({
  productName,
  productSlug,
  productVariantId,
  initialDesignState,
  assetUrls = {},
  zoneOverlays = [],
}: {
  productName: string;
  productSlug: string;
  productVariantId: string;
  initialDesignState: DesignState | null;
  /** assetId → servable url, used to rehydrate saved image layers. */
  assetUrls?: Record<string, string>;
  /** Decoration-zone boundaries to draw behind the artwork. */
  zoneOverlays?: ZoneOverlay[];
}) {
  const [state, dispatch] = useReducer(layersReducer, undefined, () => ({
    layers: (initialDesignState?.zones?.main?.layers ?? []).map((l) =>
      l.kind === "image" && assetUrls[l.assetId]
        ? ({ ...l, _src: assetUrls[l.assetId] } as RuntimeLayer)
        : (l as RuntimeLayer),
    ),
    past: [],
    future: [],
  }));
  const layers = state.layers;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<
    "idle" | "queued" | "running" | "succeeded" | "failed"
  >("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<number | null>(null);

  // --- Responsive stage scale ------------------------------------------
  // The Konva stage is a fixed 720×900 canvas; we scale the *view* to fit the
  // available width (and height) so it never overflows a narrow phone. Canvas
  // coordinates stay canonical, so snap math and saved layers are unaffected.
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(STAGE_DISPLAY_SCALE);

  // --- Mobile bottom-sheets --------------------------------------------
  const [activeSheet, setActiveSheet] = useState<"left" | "right" | null>(null);
  const [snap, setSnap] = useState<SnapLevel>("half");
  const [dragVh, setDragVh] = useState<number | null>(null);
  const dragStartRef = useRef<{ y: number; vh: number } | null>(null);

  const selected = useMemo(
    () => layers.find((l) => l.id === selectedId) ?? null,
    [layers, selectedId],
  );

  // --- Image hydration --------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const needsLoad = layers.filter(
        (l): l is ImageRuntime => l.kind === "image" && !!(l as ImageRuntime)._src && !(l as ImageRuntime)._img,
      );
      if (needsLoad.length === 0) return;
      const loaded = await Promise.all(
        needsLoad.map(async (l) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`image load failed: ${l._src}`));
            img.src = l._src!;
          });
          return { id: l.id, img };
        }),
      );
      if (cancelled) return;
      const map = new Map(loaded.map((r) => [r.id, r.img]));
      dispatch({
        type: "set",
        layers: layers.map((l) =>
          l.kind === "image" && map.has(l.id)
            ? ({ ...l, _img: map.get(l.id) } as RuntimeLayer)
            : l,
        ),
      });
    }
    hydrate().catch((err) => console.warn(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.map((l) => l.id + ((l as ImageRuntime)._src ?? "")).join("|")]);

  useEffect(() => {
    const box = stageBoxRef.current;
    if (!box) return;
    const recompute = () => {
      const availableWidth = box.clientWidth;
      const availableHeight = window.innerHeight - 88; // tab bar + breathing room
      const scale = Math.min(
        STAGE_DISPLAY_SCALE,
        availableWidth / STAGE_WIDTH,
        availableHeight / STAGE_HEIGHT,
      );
      if (scale > 0) setDisplayScale(scale);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(box);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, []);

  // --- Layer operations -------------------------------------------------

  const setLayers = useCallback(
    (next: RuntimeLayer[], markHistory = true) =>
      dispatch({ type: "set", layers: next, markHistory }),
    [],
  );

  const addText = useCallback(() => {
    const id = newId();
    const layer: TextRuntime = {
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
    setLayers([...layers, layer]);
    setSelectedId(id);
  }, [layers, setLayers]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-picking the same file
      if (!file) return;
      setUploadState("uploading");
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadCustomizerImageAction(fd);
      if (!res.ok) {
        setUploadState("error");
        return;
      }
      setUploadState("idle");
      const id = newId();
      const aspect = res.width && res.height ? res.width / res.height : 1;
      const maxDim = 400;
      const w = aspect >= 1 ? maxDim : Math.round(maxDim * aspect);
      const h = aspect >= 1 ? Math.round(maxDim / aspect) : maxDim;
      const layer: ImageRuntime = {
        kind: "image",
        id,
        assetId: res.assetId,
        _src: res.url,
        transform: {
          x: STAGE_WIDTH / 2 - w / 2,
          y: STAGE_HEIGHT / 2 - h / 2,
          width: w,
          height: h,
          rotation: 0,
        },
      };
      setLayers([...layers, layer]);
      setSelectedId(id);
    },
    [layers, setLayers],
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<RuntimeLayer>, markHistory = true) => {
      setLayers(
        layers.map((l) => (l.id === id ? ({ ...l, ...patch } as RuntimeLayer) : l)),
        markHistory,
      );
    },
    [layers, setLayers],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      setLayers(layers.filter((l) => l.id !== id));
      setSelectedId((s) => (s === id ? null : s));
    },
    [layers, setLayers],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const original = layers.find((l) => l.id === id);
      if (!original) return;
      const cloneId = newId();
      const clone: RuntimeLayer = {
        ...(original as object),
        id: cloneId,
        transform: {
          ...original.transform,
          x: original.transform.x + 20,
          y: original.transform.y + 20,
        },
      } as RuntimeLayer;
      setLayers([...layers, clone]);
      setSelectedId(cloneId);
    },
    [layers, setLayers],
  );

  const toggleLock = useCallback(
    (id: string) => {
      const l = layers.find((x) => x.id === id);
      if (!l) return;
      updateLayer(id, { _locked: !l._locked } as Partial<RuntimeLayer>);
    },
    [layers, updateLayer],
  );

  const toggleHidden = useCallback(
    (id: string) => {
      const l = layers.find((x) => x.id === id);
      if (!l) return;
      updateLayer(id, { _hidden: !l._hidden } as Partial<RuntimeLayer>);
    },
    [layers, updateLayer],
  );

  const moveLayer = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const next = [...layers];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      setLayers(next);
    },
    [layers, setLayers],
  );

  // --- Keyboard shortcuts ----------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (inField) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
        return;
      }
      if ((mod && e.key.toLowerCase() === "z" && e.shiftKey) || (mod && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          duplicateLayer(selectedId);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteLayer(selectedId);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteLayer, duplicateLayer]);

  // --- Auto-save --------------------------------------------------------

  const lastSavedRef = useRef<string>("");
  const autoSaveTimerRef = useRef<number | null>(null);

  const buildDesignState = useCallback((): DesignState => {
    const stripped = layers.map((l) => {
      // Strip runtime-only fields (_src/_img/_locked/_hidden) before
      // serializing — they don't exist in the Zod schema.
      const out = { ...l } as Record<string, unknown>;
      delete out._src;
      delete out._img;
      delete out._locked;
      delete out._hidden;
      return out as unknown as Layer;
    });
    return { zones: { main: { layers: stripped } } };
  }, [layers]);

  useEffect(() => {
    const designState = buildDesignState();
    const serialized = JSON.stringify(designState);
    if (serialized === lastSavedRef.current) return;
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      setSavingState("saving");
      const res = await saveDesignDraftAction({
        productVariantId,
        designState,
      });
      if (res.ok) {
        lastSavedRef.current = serialized;
        setSavingState("saved");
        setTimeout(() => setSavingState("idle"), 1500);
      } else {
        setSavingState("error");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [buildDesignState, productVariantId]);

  const saveNow = useCallback(async () => {
    setSavingState("saving");
    const res = await saveDesignDraftAction({
      productVariantId,
      designState: buildDesignState(),
    });
    if (res.ok) {
      lastSavedRef.current = JSON.stringify(buildDesignState());
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 1500);
    } else {
      setSavingState("error");
    }
  }, [productVariantId, buildDesignState]);

  // --- AI generation ----------------------------------------------------

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
        setLayers([...layers, layer]);
        setSelectedId(id);
        setAiPrompt("");
        setTimeout(() => setAiStatus("idle"), 1200);
      } else if (status.status === "failed" || status.status === "cancelled") {
        cancelPolling();
        setAiStatus("failed");
        setAiError(("error" in status && status.error) || "generation failed");
      }
    }, 2000) as unknown as number;
  }, [aiPrompt, productVariantId, cancelPolling, layers, setLayers]);

  useEffect(() => cancelPolling, [cancelPolling]);

  // --- Mobile sheet gestures -------------------------------------------

  const toggleSheet = useCallback((side: "left" | "right") => {
    setActiveSheet((current) => (current === side ? null : side));
    setSnap("half");
  }, []);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartRef.current = { y: e.clientY, vh: SNAP_VH[snap] };
    },
    [snap],
  );

  const onHandlePointerMove = useCallback((e: ReactPointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const deltaVh = ((start.y - e.clientY) / window.innerHeight) * 100;
    setDragVh(Math.min(96, Math.max(2, start.vh + deltaVh)));
  }, []);

  const onHandlePointerUp = useCallback(() => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;
    const finalVh = dragVh;
    setDragVh(null);
    if (finalVh === null || Math.abs(finalVh - start.vh) < 1) {
      setSnap((s) => cycleSnap(s)); // a tap (no drag) cycles the snap height
      return;
    }
    const resolved = resolveSnap(finalVh);
    if (resolved === "dismiss") setActiveSheet(null);
    else setSnap(resolved);
  }, [dragVh]);

  // --- Render -----------------------------------------------------------

  const currentVh = dragVh ?? SNAP_VH[snap];
  const showBackdrop = activeSheet !== null && currentVh > 20;
  const railTransition =
    dragVh === null ? "max-lg:transition-transform max-lg:duration-300 max-lg:ease-out" : "";

  function sheetVars(side: "left" | "right"): CSSProperties {
    return {
      "--sheet-h": `${currentVh}dvh`,
      "--sheet-y": activeSheet === side ? "0%" : "100%",
    } as CSSProperties;
  }

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr_320px] min-h-dvh">
      <aside
        style={sheetVars("left")}
        className={`flex flex-col gap-5 overflow-y-auto bg-[color:var(--color-paper-100)] p-5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-[var(--sheet-h)] max-lg:translate-y-[var(--sheet-y)] max-lg:rounded-t-2xl max-lg:border-t max-lg:border-[color:var(--color-paper-300)] max-lg:pb-20 max-lg:shadow-[0_-10px_40px_rgba(20,20,16,0.12)] ${railTransition} lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-[color:var(--color-paper-300)]/60`}
      >
        <div
          className="lg:hidden -mx-5 -mt-5 mb-1 flex shrink-0 cursor-grab touch-none items-center justify-center pt-3 pb-2"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="h-1.5 w-10 rounded-full bg-[color:var(--color-paper-300)]" aria-hidden />
        </div>

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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading"}
            className="w-full inline-flex items-center justify-between px-4 py-2.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] font-mono text-xs uppercase tracking-[0.22em] transition-colors disabled:opacity-50"
          >
            {uploadState === "uploading" ? "Uploading…" : "+ Image"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={handleUpload}
          />
          {uploadState === "error" ? (
            <p className="text-xs text-[color:var(--color-ember-700)]">
              Upload failed — use a PNG, JPEG, WebP, or AVIF under 15&nbsp;MB.
            </p>
          ) : null}
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
              {[...layers].reverse().map((l, revIdx) => {
                const idx = layers.length - 1 - revIdx;
                return (
                  <li key={l.id}>
                    <div
                      className={`group flex items-center gap-1 pr-1 transition-colors ${
                        selectedId === l.id
                          ? "bg-[color:var(--color-paper-200)]"
                          : "hover:bg-[color:var(--color-paper-200)]/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(l.id)}
                        className="flex-1 text-left px-2 py-1.5 text-xs"
                      >
                        <span className="truncate inline-block max-w-[120px] align-middle text-[color:var(--color-ink-800)]">
                          {l.kind === "text"
                            ? `"${(l as TextLayer).content.slice(0, 18)}"`
                            : "Image"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleHidden(l.id)}
                        title={l._hidden ? "Show" : "Hide"}
                        className="font-mono text-[0.6rem] px-1 text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-950)]"
                      >
                        {l._hidden ? "◍" : "●"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLock(l.id)}
                        title={l._locked ? "Unlock" : "Lock"}
                        className="font-mono text-[0.6rem] px-1 text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-950)]"
                      >
                        {l._locked ? "🔒" : "○"}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(l.id, 1)}
                        disabled={idx === layers.length - 1}
                        title="Bring forward"
                        className="font-mono text-[0.6rem] px-1 text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-950)] disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(l.id, -1)}
                        disabled={idx === 0}
                        title="Send backward"
                        className="font-mono text-[0.6rem] px-1 text-[color:var(--color-ink-400)] hover:text-[color:var(--color-ink-950)] disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "undo" })}
              disabled={state.past.length === 0}
              title="Undo (⌘Z)"
              className="flex-1 inline-flex items-center justify-center py-1.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] font-mono text-[0.6rem] uppercase tracking-[0.18em] transition-colors disabled:opacity-40"
            >
              ↺ Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "redo" })}
              disabled={state.future.length === 0}
              title="Redo (⌘⇧Z)"
              className="flex-1 inline-flex items-center justify-center py-1.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] font-mono text-[0.6rem] uppercase tracking-[0.18em] transition-colors disabled:opacity-40"
            >
              Redo ↻
            </button>
          </div>
          <button
            type="button"
            onClick={saveNow}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] font-mono text-xs uppercase tracking-[0.22em] transition-colors"
          >
            {savingState === "saving"
              ? "Saving…"
              : savingState === "saved"
                ? "Saved ✓"
                : savingState === "error"
                  ? "Save failed"
                  : "Save now"}
          </button>
        </div>
      </aside>

      {/* CENTER — stage */}
      <main className="flex items-center justify-center overflow-auto bg-[color:var(--color-paper-50)] p-4 max-lg:pb-20 sm:p-8">
        <div ref={stageBoxRef} className="flex w-full items-center justify-center">
          <div
            className="surface-noise hairline shadow-sm"
            style={{
              width: STAGE_WIDTH * displayScale,
              height: STAGE_HEIGHT * displayScale,
            }}
          >
            <StageView
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              displayScale={displayScale}
              snapThreshold={SNAP_THRESHOLD}
              layers={layers}
              zones={zoneOverlays}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(id, patch, commit) => updateLayer(id, patch, commit)}
            />
          </div>
        </div>
      </main>

      {/* RIGHT — properties + AI panel */}
      <aside
        style={sheetVars("right")}
        className={`flex flex-col gap-6 overflow-y-auto bg-[color:var(--color-paper-100)] p-5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-[var(--sheet-h)] max-lg:translate-y-[var(--sheet-y)] max-lg:rounded-t-2xl max-lg:border-t max-lg:border-[color:var(--color-paper-300)] max-lg:pb-20 max-lg:shadow-[0_-10px_40px_rgba(20,20,16,0.12)] ${railTransition} lg:sticky lg:top-0 lg:h-dvh lg:border-l lg:border-[color:var(--color-paper-300)]/60`}
      >
        <div
          className="lg:hidden -mx-5 -mt-5 mb-1 flex shrink-0 cursor-grab touch-none items-center justify-center pt-3 pb-2"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="h-1.5 w-10 rounded-full bg-[color:var(--color-paper-300)]" aria-hidden />
        </div>

        {selected ? (
          <PropertiesPanel
            layer={selected}
            onChange={(p) => updateLayer(selected.id, p as Partial<RuntimeLayer>, false)}
            onCommit={(p) => updateLayer(selected.id, p as Partial<RuntimeLayer>, true)}
            onDelete={() => deleteLayer(selected.id)}
            onDuplicate={() => duplicateLayer(selected.id)}
          />
        ) : (
          <p className="text-xs text-[color:var(--color-ink-400)]">
            Select a layer to edit its properties. ⌘Z to undo, ⌘D to duplicate, Delete to remove, Esc to deselect.
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

      {/* Mobile: scrim behind an opened sheet (not at the peek height). */}
      {showBackdrop ? (
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => setActiveSheet(null)}
          className="lg:hidden fixed inset-0 z-30 bg-[color:var(--color-ink-950)]/20"
        />
      ) : null}

      {/* Mobile: bottom tab bar launches each rail as a sheet. */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-2 border-t border-[color:var(--color-paper-300)] bg-[color:var(--color-paper-100)]">
        <button
          type="button"
          onClick={() => toggleSheet("left")}
          className={`font-mono text-[0.65rem] uppercase tracking-[0.22em] transition-colors ${
            activeSheet === "left"
              ? "bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)]"
              : "text-[color:var(--color-ink-600)]"
          }`}
        >
          Layers
        </button>
        <button
          type="button"
          onClick={() => toggleSheet("right")}
          className={`font-mono text-[0.65rem] uppercase tracking-[0.22em] transition-colors ${
            activeSheet === "right"
              ? "bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)]"
              : "text-[color:var(--color-ink-600)]"
          }`}
        >
          Edit
        </button>
      </nav>
    </div>
  );
}

// --- Properties panel ------------------------------------------------------

function PropertiesPanel({
  layer,
  onChange,
  onCommit,
  onDelete,
  onDuplicate,
}: {
  layer: RuntimeLayer;
  onChange: (patch: Partial<Layer>) => void;
  onCommit: (patch: Partial<Layer>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          {layer.kind} layer
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDuplicate}
            className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ember-700)] hover:text-[color:var(--color-ember-900)] transition-colors"
          >
            Delete
          </button>
        </div>
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
              onBlur={(e) => onCommit({ content: e.target.value })}
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
              onChange={(e) => onCommit({ fontFamily: e.target.value })}
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
                onBlur={(e) => onCommit({ fontSize: Number(e.target.value) })}
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
                onBlur={(e) => onCommit({ color: e.target.value })}
                className="w-full h-10 bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] cursor-pointer"
              />
            </label>
          </div>
        </>
      ) : null}

      {layer.kind === "image" ? (
        <p className="text-xs text-[color:var(--color-ink-600)]">
          Image · drag handles on the stage to resize and rotate.
        </p>
      ) : null}
    </div>
  );
}
