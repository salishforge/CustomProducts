import type { Project } from './types';
import { composite, ctx2d, makeCanvas, renderLayers, tintMask, type Imgs, type Proof } from './compose';
import { canvasToPng } from './png';

export type WhiteFormat = 'transparent' | 'black';

export const EXPORT_LABELS: Record<Proof, string> = {
  color: 'Colour layer',
  white: 'White underbase',
  day: 'Daylight proof',
  night: 'Lights-out proof',
};

/** Render a layer at full print resolution with DPI metadata. */
export async function exportLayer(p: Project, imgs: Imgs, kind: Proof, whiteFmt: WhiteFormat = 'transparent'): Promise<Blob> {
  const L = renderLayers(p, imgs, p.dpi);
  let c: HTMLCanvasElement;
  if (kind === 'white') {
    if (whiteFmt === 'transparent') c = L.white;
    else {
      c = makeCanvas(L.W, L.H);
      const x = ctx2d(c);
      x.fillStyle = '#fff'; x.fillRect(0, 0, L.W, L.H);
      x.drawImage(tintMask(L.white, '#000'), 0, 0);
    }
  } else c = composite(kind, L, p);
  return canvasToPng(c, p.dpi);
}
