export type RGB = [number, number, number];

export type Template = {
  id: string;
  name: string;
  widthIn: number;
  heightIn: number;
  seamless: boolean;
};

/** A cut-out image stored inside the project as a PNG data URL. */
export type Asset = { id: string; name: string; src: string; w: number; h: number };

/** Positions are fractions of the wrap: cx of width, cy and h of height. */
export type Subject = {
  id: string;
  assetId: string;
  cx: number;
  cy: number;
  h: number;
  rot: number;
  flip: boolean;
  underbase: boolean;
  opacity: number;
};

export type MotifType = 'embers' | 'halo' | 'bands' | 'rays' | 'scatter';

/** Motifs always print tint-only (no white) so the substrate glows through them. */
export type Motif = {
  id: string;
  type: MotifType;
  visible: boolean;
  seed: number;
  color: string;
  opacity: number;
  density: number;
  size: number;
  cx: number;
  cy: number;
  assetId?: string;
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  templateId: string;
  widthIn: number;
  heightIn: number;
  seamless: boolean;
  dpi: number;
  substrate: string;
  glow: string;
  /** Underbase choke in pixels at print DPI. */
  chokePx: number;
  assets: Asset[];
  subjects: Subject[];
  motifs: Motif[];
};
