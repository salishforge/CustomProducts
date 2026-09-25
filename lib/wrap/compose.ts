import type { Project, Subject } from './types';
import { drawMotif } from './motifs';
import { whiteLayer } from './separation';
import { mod, shade } from './util';

export type Proof = 'day' | 'color' | 'white' | 'night';
export type View = Proof | 'seam' | 'barrel';
export type Imgs = Map<string, HTMLImageElement>;

export type Layers = {
  W: number;
  H: number;
  /** Tint-only background ink. */
  motif: HTMLCanvasElement;
  /** Subjects printed without underbase. */
  loose: HTMLCanvasElement;
  /** Subjects printed over white. */
  subject: HTMLCanvasElement;
  /** White underbase: opaque white where white prints. */
  white: HTMLCanvasElement;
};

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}
export const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d') as CanvasRenderingContext2D;

export function drawSubject(x: CanvasRenderingContext2D, s: Subject, img: HTMLImageElement, W: number, H: number, wrap: boolean) {
  const hh = s.h * H, ww = (hh * img.width) / img.height;
  for (const dx of wrap ? [-W, 0, W] : [0]) {
    x.save();
    x.translate(s.cx * W + dx, s.cy * H);
    x.rotate((s.rot * Math.PI) / 180);
    x.scale(s.flip ? -1 : 1, 1);
    x.globalAlpha = s.opacity;
    x.drawImage(img, -ww / 2, -hh / 2, ww, hh);
    x.restore();
  }
}

export function renderLayers(p: Project, imgs: Imgs, ppi: number): Layers {
  const W = Math.round(p.widthIn * ppi), H = Math.round(p.heightIn * ppi);
  const motif = makeCanvas(W, H);
  const mx = ctx2d(motif);
  for (const m of p.motifs) {
    if (!m.visible) continue;
    const t = makeCanvas(W, H);
    drawMotif(ctx2d(t), m, W, H, imgs, p.seamless);
    mx.drawImage(t, 0, 0);
  }
  const loose = makeCanvas(W, H), subject = makeCanvas(W, H);
  for (const s of p.subjects) {
    const img = imgs.get(s.assetId);
    if (img) drawSubject(ctx2d(s.underbase ? subject : loose), s, img, W, H, p.seamless);
  }
  const white = whiteLayer(subject, Math.round((p.chokePx * ppi) / p.dpi), p.seamless);
  return { W, H, motif, loose, subject, white };
}

export function tintMask(mask: HTMLCanvasElement, color: string) {
  const c = makeCanvas(mask.width, mask.height), x = ctx2d(c);
  x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * day   – substrate with ink multiplied over it; underbased art prints opaque.
 * color – the CMYK layer file on transparent.
 * white – underbase preview (white on black).
 * night – glowing substrate; white blocks glow (black silhouette), tint ink dims it.
 */
export function composite(view: Proof, L: Layers, p: Project): HTMLCanvasElement {
  const { W, H } = L;
  const c = makeCanvas(W, H), x = ctx2d(c);
  if (view === 'color') {
    x.drawImage(L.motif, 0, 0); x.drawImage(L.loose, 0, 0); x.drawImage(L.subject, 0, 0);
  } else if (view === 'white') {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.drawImage(L.white, 0, 0);
  } else if (view === 'day') {
    x.fillStyle = p.substrate; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'multiply';
    x.drawImage(L.motif, 0, 0); x.drawImage(L.loose, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.drawImage(L.subject, 0, 0);
  } else {
    const g = x.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, Math.max(W, H) * 0.75);
    g.addColorStop(0, p.glow); g.addColorStop(0.58, shade(p.glow, 0.78)); g.addColorStop(1, shade(p.glow, 0.45));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = 0.85;
    x.drawImage(L.motif, 0, 0); x.drawImage(L.loose, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.drawImage(tintMask(L.white, '#080304'), 0, 0);
  }
  return c;
}

/** Shift by half a turn so the seam sits in the middle. */
export function drawSeam(src: HTMLCanvasElement) {
  const c = makeCanvas(src.width, src.height), x = ctx2d(c);
  const h = Math.floor(src.width / 2);
  x.drawImage(src, h, 0);
  x.drawImage(src, h - src.width, 0);
  x.setLineDash([8, 6]);
  x.strokeStyle = 'rgba(255,217,168,.9)';
  x.lineWidth = 1;
  x.beginPath(); x.moveTo(h + 0.5, 0); x.lineTo(h + 0.5, src.height); x.stroke();
  return c;
}

/** Front-on view of the barrel. rot 0.5 = centre of the wrap faces the viewer. */
export function drawBarrel(src: HTMLCanvasElement, rot: number) {
  const W = src.width, H = src.height, D = Math.round(W / Math.PI);
  const c = makeCanvas(D, H), x = ctx2d(c);
  for (let i = 0; i < D; i++) {
    const u = ((i + 0.5) / D) * 2 - 1;
    const sx = Math.floor(mod(rot + Math.asin(u) / (2 * Math.PI), 1) * W);
    x.drawImage(src, sx, 0, 1, H, i, 0, 1, H);
  }
  const g = x.createLinearGradient(0, 0, D, 0);
  g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.18, 'rgba(0,0,0,.12)');
  g.addColorStop(0.4, 'rgba(255,255,255,.08)'); g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(0.85, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
  x.fillStyle = g; x.fillRect(0, 0, D, H);
  return c;
}
