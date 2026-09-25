'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { cutout, sampleAt, sampleCorners, hasTransparency, trimCanvas, DEFAULT_CUTOUT, type CutoutOptions } from '@/lib/wrap/cutout';
import { ctx2d, makeCanvas } from '@/lib/wrap/compose';
import { hexToRgb, rgbToHex } from '@/lib/wrap/util';
import type { Asset } from '@/lib/wrap/types';
import { ColorField, Range, Toggle } from './controls';

const MAX_FULL = 3600;
const MAX_PREVIEW = 720;

type Source = { full: ImageData; small: ImageData; scale: number };
export type ArtworkUse = 'subject' | 'chips';

function toImageData(img: CanvasImageSource, w: number, h: number) {
  const c = makeCanvas(w, h), x = ctx2d(c);
  x.drawImage(img, 0, 0, w, h);
  return x.getImageData(0, 0, w, h);
}

function toCanvas(d: ImageData) {
  const c = makeCanvas(d.width, d.height);
  ctx2d(c).putImageData(d, 0, 0);
  return c;
}

export default function CutoutPanel({ file, allowChips, onCancel, onDone }: {
  file: File;
  allowChips: boolean;
  onCancel: () => void;
  onDone: (asset: Omit<Asset, 'id'>, use: ArtworkUse) => void;
}) {
  const [src, setSrc] = useState<Source | null>(null);
  const [opts, setOpts] = useState<CutoutOptions | null>(null);
  const [skip, setSkip] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      if (!alive) return;
      const s0 = Math.min(1, MAX_FULL / Math.max(im.width, im.height));
      const full = toImageData(im, Math.round(im.width * s0), Math.round(im.height * s0));
      const s = Math.min(1, MAX_PREVIEW / Math.max(full.width, full.height));
      const small = toImageData(toCanvas(full), Math.round(full.width * s), Math.round(full.height * s));
      setSrc({ full, small, scale: s });
      setOpts({ ...DEFAULT_CUTOUT, key: sampleCorners(full) });
      setSkip(hasTransparency(full));
      URL.revokeObjectURL(url);
    };
    im.onerror = () => setError('That file could not be read as an image.');
    im.src = url;
    return () => { alive = false; };
  }, [file]);

  useEffect(() => {
    const c = preview.current;
    if (!src || !opts || !c) return;
    const t = setTimeout(() => {
      c.width = src.small.width; c.height = src.small.height;
      const scaled = { ...opts, choke: Math.round(opts.choke * src.scale), minIsland: Math.round(opts.minIsland * src.scale * src.scale) };
      ctx2d(c).putImageData(skip ? src.small : cutout(src.small, scaled), 0, 0);
    }, 40);
    return () => clearTimeout(t);
  }, [src, opts, skip]);

  const set = (patch: Partial<CutoutOptions>) => setOpts(o => (o ? { ...o, ...patch } : o));

  const pick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!src || skip) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * src.small.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * src.small.height);
    set({ key: sampleAt(src.small, x, y, 2) });
  };

  const finish = (use: ArtworkUse) => {
    if (!src || !opts) return;
    setWorking(true);
    setTimeout(() => {
      const out = trimCanvas(toCanvas(skip ? src.full : cutout(src.full, opts)));
      onDone({ name: file.name.replace(/\.[^.]+$/, ''), src: out.toDataURL('image/png'), w: out.width, h: out.height }, use);
    }, 30);
  };

  return (
    <div className="ws-modal" role="dialog" aria-label="Cut out artwork">
      <div className="ws-modal-card ws-cutout">
        <div className="ws-cutout-view">
          <canvas ref={preview} className="ws-checker" onClick={pick} style={{ cursor: skip ? 'default' : 'crosshair' }} />
          {!src && !error && <p className="ws-hint">Loading…</p>}
          {error && <p className="ws-hint">{error}</p>}
        </div>
        <div className="ws-cutout-controls">
          <h2>Cut out artwork</h2>
          {opts && (
            <>
              <Toggle label="Artwork already has transparency" checked={skip} onChange={setSkip} />
              {!skip && (
                <>
                  <p className="ws-hint">Click the preview to pick the background colour.</p>
                  <ColorField label="Background colour" value={rgbToHex(opts.key)} onChange={v => set({ key: hexToRgb(v) })} />
                  <Range label="Tolerance" value={opts.tolerance} min={0} max={200} step={1} onChange={v => set({ tolerance: v })} />
                  <Range label="Edge softness" value={opts.softness} min={1} max={120} step={1} onChange={v => set({ softness: v })} />
                  <Range label="Edge choke" value={opts.choke} min={0} max={6} step={1} onChange={v => set({ choke: v })} fmt={v => `${v}px`} />
                  <Range label="Remove specks under" value={opts.minIsland} min={0} max={6000} step={50} onChange={v => set({ minIsland: v })} fmt={v => `${v}px`} />
                  <Toggle label="Only remove background touching the edges" hint="Turn off to also clear enclosed gaps, e.g. sky between wings." checked={opts.flood} onChange={v => set({ flood: v })} />
                  <Toggle label="Clean colour fringe" checked={opts.despill} onChange={v => set({ despill: v })} />
                </>
              )}
            </>
          )}
          <div className="ws-row ws-end">
            <button className="ws-btn ghost" onClick={onCancel} disabled={working}>Cancel</button>
            {allowChips && <button className="ws-btn" onClick={() => finish('chips')} disabled={!src || working}>Use as motif chips</button>}
            <button className="ws-btn primary" onClick={() => finish('subject')} disabled={!src || working}>{working ? 'Processing…' : 'Place on wrap'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
