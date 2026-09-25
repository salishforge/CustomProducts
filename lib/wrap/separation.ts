/**
 * Build the white underbase from the rendered subject layer: solid white where the
 * subject is at least half opaque, choked inward so no white peeks past the colour.
 * Horizontal erosion wraps around the seam on seamless products.
 */
export function whiteLayer(subject: HTMLCanvasElement, choke: number, wrap: boolean): HTMLCanvasElement {
  const w = subject.width, h = subject.height;
  const sx = subject.getContext('2d') as CanvasRenderingContext2D;
  const src = sx.getImageData(0, 0, w, h).data;
  let m: Uint8Array = new Uint8Array(w * h);
  for (let p = 0; p < m.length; p++) m[p] = src[p * 4 + 3]! >= 128 ? 1 : 0;
  if (choke > 0) m = erode(m, w, h, choke, wrap);

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ox = out.getContext('2d') as CanvasRenderingContext2D;
  const img = ox.createImageData(w, h);
  for (let p = 0; p < m.length; p++) if (m[p]) {
    const i = p * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = img.data[i + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  return out;
}

function erode(m: Uint8Array, w: number, h: number, r: number, wrap: boolean): Uint8Array {
  const t = new Uint8Array(w * h);
  const pre = new Int32Array(w + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x]! + m[o + x]!;
    const sum = (a: number, b: number) => pre[b + 1]! - pre[a]!;
    for (let x = 0; x < w; x++) {
      if (!m[o + x]) continue;
      let a = x - r, b = x + r, s: number, n: number;
      if (wrap && r * 2 + 1 < w) {
        n = r * 2 + 1;
        if (a < 0) s = sum(0, b) + sum(w + a, w - 1);
        else if (b >= w) s = sum(a, w - 1) + sum(0, b - w);
        else s = sum(a, b);
      } else {
        a = Math.max(0, a); b = Math.min(w - 1, b);
        n = b - a + 1; s = sum(a, b);
      }
      t[o + x] = s === n ? 1 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  const col = new Int32Array(h + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y + 1] = col[y]! + t[y * w + x]!;
    for (let y = 0; y < h; y++) {
      if (!t[y * w + x]) continue;
      const a = Math.max(0, y - r), b = Math.min(h - 1, y + r);
      out[y * w + x] = col[b + 1]! - col[a]! === b - a + 1 ? 1 : 0;
    }
  }
  return out;
}
