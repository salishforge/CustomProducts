import type { Motif, MotifType } from './types';
import { rng, rgba } from './util';

export const MOTIF_LABELS: Record<MotifType, string> = {
  embers: 'Embers',
  halo: 'Halo ring',
  bands: 'Border bands',
  rays: 'Rays',
  scatter: 'Artwork chips',
};

type Ctx = CanvasRenderingContext2D;

/**
 * Draws one motif into its own layer. Anything that can cross the seam is drawn
 * three times (−W, 0, +W) back to back, so paint order across the join matches
 * paint order inside the panel. Never gate clones on position — rotation makes
 * rendered extents wider than the layout box.
 */
export function drawMotif(ctx: Ctx, m: Motif, W: number, H: number, imgs: Map<string, HTMLImageElement>, wrap: boolean) {
  const off = wrap ? [-W, 0, W] : [0];
  const r = rng(m.seed);
  const c = (a: number) => rgba(m.color, a * m.opacity);
  const TAU = Math.PI * 2;

  switch (m.type) {
    case 'embers': {
      const n = Math.round(20 + m.density * 380);
      for (let i = 0; i < n; i++) {
        const x = r() * W;
        const y = H * (1 - Math.pow(r(), 1.8));
        const rad = (1 + (0.4 + r() * 1.6) * m.size * H * 0.014) * 2.2;
        const a = 0.35 + 0.65 * r();
        for (const dx of off) {
          const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
          g.addColorStop(0, c(a)); g.addColorStop(0.45, c(a * 0.7)); g.addColorStop(1, c(0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x + dx, y, rad, 0, TAU); ctx.fill();
        }
      }
      break;
    }
    case 'halo': {
      const R = m.size * H * 0.5;
      const cx = m.cx * W, cy = m.cy * H;
      for (const dx of off) {
        const g = ctx.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, R * 1.3);
        g.addColorStop(0, c(1)); g.addColorStop(0.62, c(0.92)); g.addColorStop(0.8, c(0.4)); g.addColorStop(1, c(0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx + dx, cy, R * 1.3, 0, TAU); ctx.fill();
      }
      // Cut an unprinted ring so the glow shows as a clean circle.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(2, R * (0.04 + m.density * 0.08));
      for (const dx of off) { ctx.beginPath(); ctx.arc(cx + dx, cy, R * 0.84, 0, TAU); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'bands': {
      const bh = Math.max(2, m.size * H * 0.07);
      const inset = H * 0.035, gap = bh * 0.5, rule = Math.max(1, bh * 0.12);
      ctx.fillStyle = c(1);
      ctx.fillRect(0, inset, W, bh);
      ctx.fillRect(0, H - inset - bh, W, bh);
      ctx.fillStyle = c(0.8);
      ctx.fillRect(0, inset + bh + gap, W, rule);
      ctx.fillRect(0, H - inset - bh - gap - rule, W, rule);
      // Studs are evenly spaced by an integer count so they tile across the seam.
      const studs = Math.round(m.density * 40);
      if (studs > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        const s = bh * 0.28;
        for (let i = 0; i < studs; i++) {
          const x = (i + 0.5) * (W / studs);
          for (const y of [inset + bh / 2, H - inset - bh / 2]) {
            ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      }
      break;
    }
    case 'rays': {
      // Built on a 3W-wide sheet so rays that run past either edge wrap back in.
      const n = 2 * Math.round(6 + m.density * 18);
      const rot0 = r() * Math.PI;
      const t = document.createElement('canvas');
      t.width = W * 3; t.height = H;
      const tx = t.getContext('2d') as Ctx;
      const cx = W + m.cx * W, cy = m.cy * H, L = Math.hypot(W * 1.5, H);
      tx.fillStyle = c(1);
      for (let k = 0; k < n; k += 2) {
        const a0 = rot0 + (k / n) * TAU;
        tx.beginPath(); tx.moveTo(cx, cy); tx.arc(cx, cy, L, a0, a0 + TAU / n); tx.closePath(); tx.fill();
      }
      tx.globalCompositeOperation = 'destination-in';
      const R = m.size * H * 0.9;
      const g = tx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = g; tx.fillRect(0, 0, t.width, H);
      for (const dx of off) ctx.drawImage(t, -W + dx, 0);
      break;
    }
    case 'scatter': {
      const img = m.assetId ? imgs.get(m.assetId) : undefined;
      if (!img) break;
      const n = Math.round(4 + m.density * 56);
      const big = Math.max(img.width, img.height);
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = H * (0.05 + r() * 0.9);
        const s = (0.5 + r()) * m.size * H * 0.18;
        const rot = r() * TAU, a = 0.5 + 0.5 * r(), flip = r() < 0.5;
        const w = (s * img.width) / big, h = (s * img.height) / big;
        for (const dx of off) {
          ctx.save();
          ctx.translate(x + dx, y); ctx.rotate(rot); ctx.scale(flip ? -1 : 1, 1);
          ctx.globalAlpha = a * m.opacity;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      }
      break;
    }
  }
}
