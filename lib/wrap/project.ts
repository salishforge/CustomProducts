import type { Motif, MotifType, Project, Subject } from './types';
import { templateById } from './templates';
import { uid } from './util';

export function newProject(templateId = 'skinny-20'): Project {
  const t = templateById(templateId);
  return {
    version: 1,
    id: uid(),
    name: 'Untitled wrap',
    templateId: t.id,
    widthIn: t.widthIn,
    heightIn: t.heightIn,
    seamless: t.seamless,
    dpi: 300,
    substrate: '#c4402f',
    glow: '#ff5330',
    chokePx: 2,
    assets: [],
    subjects: [],
    motifs: [newMotif('embers')],
  };
}

export const newSubject = (assetId: string): Subject => ({
  id: uid(), assetId, cx: 0.5, cy: 0.52, h: 0.82, rot: 0, flip: false, underbase: true, opacity: 1,
});

const MOTIF_DEFAULTS: Record<MotifType, Partial<Motif>> = {
  embers: { color: '#521107', opacity: 0.8, density: 0.35, size: 0.5 },
  halo: { color: '#160706', opacity: 0.95, density: 0.4, size: 0.85, cx: 0.5, cy: 0.5 },
  bands: { color: '#160706', opacity: 0.9, density: 0.3, size: 0.5 },
  rays: { color: '#521107', opacity: 0.6, density: 0.4, size: 0.8, cx: 0.5, cy: 0.55 },
  scatter: { color: '#000000', opacity: 0.5, density: 0.3, size: 0.5 },
};

export function newMotif(type: MotifType): Motif {
  return {
    id: uid(), type, visible: true, seed: Math.floor(Math.random() * 1e9),
    color: '#160706', opacity: 0.8, density: 0.4, size: 0.5, cx: 0.5, cy: 0.5,
    ...MOTIF_DEFAULTS[type],
  };
}

export function parseProject(text: string): Project {
  const p = JSON.parse(text);
  if (!p || p.version !== 1 || !Array.isArray(p.subjects) || !Array.isArray(p.assets)) {
    throw new Error('Not a Wrap Studio project file');
  }
  return { ...newProject(), ...p } as Project;
}
