import type { RGB } from './types';

export type CutoutOptions = {
  key: RGB;
  /** Colour distance (0–442) below which pixels are fully removed. */
  tolerance: number;
  /** Extra distance over which alpha ramps back to opaque. */
  softness: number;
  /** Only remove background connected to the image edge (keeps interior highlights). */
  flood: boolean;
  /** Remove key-colour fringe from semi-transparent edge pixels. */
  despill: boolean;
  /** Drop opaque specks smaller than this many pixels. */
  minIsland: number;
  /** Shrink the matte by this many pixels. */
  choke: number;
};

export const DEFAULT_CUTOUT: Omit<CutoutOptions, 'key'> = {
  tolerance: 42,
  softness: 36,
  flood: true,
  despill: true,
  minIsland: 600,
  choke: 1,
};

/** Median of small patches in the four corners — a good guess for a flat backdrop. */
export function sampleCorners(d: ImageData): RGB {
  const { width: w, height: h, data } = d;
  const n = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const ch: number[][] = [[], [], []];
  for (const [x0, y0] of [[0, 0], [w - n, 0], [0, h - n], [w - n, h - n]] as [number, number][]) {
    for (let y = y0; y < y0 + n; y++)
      for (let x = x0; x < x0 + n; x++) {
        const i = (y * w + x) * 4;
        ch[0]!.push(data[i]!); ch[1]!.push(data[i + 1]!); ch[2]!.push(data[i + 2]!);
      }
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1]!; // each channel always has samples: n >= 2, 4 corners sampled
  return [med(ch[0]!), med(ch[1]!), med(ch[2]!)];
}

export function sampleAt(d: ImageData, x: number, y: number, r = 2): RGB {
  let R = 0, G = 0, B = 0, n = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(d.height - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(d.width - 1, x + r); xx++) {
      const i = (yy * d.width + xx) * 4;
      R += d.data[i]!; G += d.data[i + 1]!; B += d.data[i + 2]!; n++;
    }
  return [R / n, G / n, B / n];
}

export function hasTransparency(d: ImageData) {
  const step = Math.max(1, Math.floor((d.width * d.height) / 20000)) * 4;
  for (let i = 3; i < d.data.length; i += step) if (d.data[i]! < 250) return true;
  return false;
}

export function cutout(src: ImageData, o: CutoutOptions): ImageData {
  const { width: w, height: h } = src;
  const s = src.data;
  const N = w * h;
  const [kr, kg, kb] = o.key;
  const dist = new Float32Array(N);
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const dr = s[i]! - kr, dg = s[i + 1]! - kg, db = s[i + 2]! - kb;
    dist[p] = Math.sqrt(dr * dr + dg * dg + db * db);
  }
  const lo = o.tolerance;
  const hi = o.tolerance + Math.max(1, o.softness);
  const ramp = (v: number) => (v <= lo ? 0 : v >= hi ? 1 : (v - lo) / (hi - lo));
  const a = new Float32Array(N).fill(1);

  if (o.flood) {
    const seen = new Uint8Array(N);
    const q = new Int32Array(N);
    let head = 0, tail = 0;
    const spread = lo + (hi - lo) * 0.5;
    const push = (p: number) => {
      if (!seen[p] && dist[p]! < hi) { seen[p] = 1; q[tail++] = p; }
    };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const p = q[head++]!;
      const dp = dist[p]!;
      a[p] = ramp(dp);
      if (dp > spread) continue; // edge pixels get soft alpha but don't spread inward
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < N - w) push(p + w);
    }
  } else {
    for (let p = 0; p < N; p++) a[p] = ramp(dist[p]!);
  }

  if (o.minIsland > 0) removeIslands(a, w, h, o.minIsland);
  if (o.choke > 0) erodeAlpha(a, w, h, Math.round(o.choke));

  const out = new ImageData(new Uint8ClampedArray(s), w, h);
  const d = out.data;
  const k = [kr, kg, kb];
  for (let p = 0, i = 0; p < N; p++, i += 4) {
    const al = a[p]!;
    d[i + 3] = Math.round(al * s[i + 3]!);
    if (o.despill && al > 0.02 && al < 0.98) {
      for (let c = 0; c < 3; c++) d[i + c] = (s[i + c]! - k[c]! * (1 - al)) / al;
    }
  }
  return out;
}

function removeIslands(a: Float32Array, w: number, h: number, min: number) {
  const N = w * h;
  const label = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  for (let start = 0; start < N; start++) {
    if (a[start]! < 0.5 || label[start] !== -1) continue;
    let head = 0, tail = 0;
    q[tail++] = start; label[start] = start;
    while (head < tail) {
      const p = q[head++]!;
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1];
      for (const n of nb) if (n >= 0 && label[n] === -1 && a[n]! >= 0.5) { label[n] = start; q[tail++] = n; }
    }
    if (tail < min) for (let j = 0; j < tail; j++) a[q[j]!] = 0;
  }
  // Clear faint alpha that isn't next to a kept region.
  for (let p = 0; p < N; p++) if (a[p]! > 0 && a[p]! < 0.5) {
    const x = p % w;
    const near = (x > 0 && a[p - 1]! >= 0.5) || (x < w - 1 && a[p + 1]! >= 0.5) || (p >= w && a[p - w]! >= 0.5) || (p < N - w && a[p + w]! >= 0.5);
    if (!near) a[p] = 0;
  }
}

function erodeAlpha(a: Float32Array, w: number, h: number, r: number) {
  const t = new Float32Array(a.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 1;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.min(m, a[y * w + k]!);
      t[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 1;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.min(m, t[k * w + x]!);
      a[y * w + x] = m;
    }
}

/** Crop a canvas to its non-transparent bounds. */
export function trimCanvas(c: HTMLCanvasElement, pad = 4): HTMLCanvasElement {
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const { data, width: w, height: h } = x.getImageData(0, 0, c.width, c.height);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let xx = 0; xx < w; xx++)
      if (data[(y * w + xx) * 4 + 3]! > 8) {
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  (out.getContext('2d') as CanvasRenderingContext2D).drawImage(c, -x0, -y0);
  return out;
}
