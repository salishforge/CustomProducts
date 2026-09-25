'use client';
import './wrap-studio.css';
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import type { Asset, Motif, MotifType, Project, Subject } from '@/lib/wrap/types';
import { TEMPLATES, templateById } from '@/lib/wrap/templates';
import { newMotif, newProject, newSubject, parseProject } from '@/lib/wrap/project';
import { composite, drawBarrel, drawSeam, renderLayers, type Imgs, type Layers, type Proof, type View } from '@/lib/wrap/compose';
import { EXPORT_LABELS, exportLayer, type WhiteFormat } from '@/lib/wrap/exporter';
import { MOTIF_LABELS } from '@/lib/wrap/motifs';
import { download } from '@/lib/wrap/png';
import { deleteProject, listProjects, saveProject, type Saved } from '@/lib/wrap/storage';
import { clamp, mod, slug, uid } from '@/lib/wrap/util';
import CutoutPanel, { type ArtworkUse } from './CutoutPanel';
import { ColorField, Range, Section, Toggle, pct } from './controls';

const PREVIEW_PPI = 96;

const VIEW_LABELS: Record<View, string> = {
  day: 'Daylight', color: 'Colour layer', white: 'White underbase', night: 'Lights out', seam: 'Seam', barrel: 'Tumbler',
};
const VIEW_HINTS: Record<View, string> = {
  day: 'Proof on the substrate. Drag artwork to move it.',
  color: 'The colour file as it prints. Transparent areas stay unprinted.',
  white: 'White blocks the glow. Black lets the substrate glow through.',
  night: 'Predicted glow with the lights off. Underbased art reads as a silhouette.',
  seam: 'Shifted half a turn so the seam sits on the dashed line. Nothing should break across it.',
  barrel: 'Front-on view of the tumbler.',
};

export type WrapStudioProps = {
  /** staff: full print-layer export. customer: design + proof only. */
  audience?: 'staff' | 'customer';
  initialProject?: Project;
  /** Customer submit hook, e.g. attach to a cart or order request. */
  onSubmit?: (project: Project, proof: Blob) => void | Promise<void>;
};

function paint(c: HTMLCanvasElement, view: View, L: Layers, p: Project, rot: number, sel: Subject | null, imgs: Imgs) {
  const src = view === 'seam' ? drawSeam(composite('day', L, p))
    : view === 'barrel' ? drawBarrel(composite('day', L, p), rot)
    : composite(view, L, p);
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.drawImage(src, 0, 0);
  const img = sel && imgs.get(sel.assetId);
  if (sel && img && view !== 'seam' && view !== 'barrel') {
    const hh = sel.h * L.H, ww = (hh * img.width) / img.height;
    x.save();
    x.translate(sel.cx * L.W, sel.cy * L.H);
    x.rotate((sel.rot * Math.PI) / 180);
    x.setLineDash([6, 5]); x.strokeStyle = '#ffd9a8'; x.lineWidth = 1.5;
    x.strokeRect(-ww / 2, -hh / 2, ww, hh);
    x.restore();
  }
}

export default function WrapStudio({ audience = 'staff', initialProject, onSubmit }: WrapStudioProps) {
  const staff = audience === 'staff';
  const [p, setP] = useState<Project>(() => initialProject ?? newProject());
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<View>('day');
  const [rot, setRot] = useState(0.5);
  const [imgs, setImgs] = useState<Imgs>(() => new Map());
  const [cutting, setCutting] = useState<File | null>(null);
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [whiteFmt, setWhiteFmt] = useState<WhiteFormat>('transparent');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<Layers | null>(null);
  const loading = useRef(new Set<string>());
  const drag = useRef<{ id: string; x: number; y: number; cx: number; cy: number } | null>(null);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(null), 2200); };

  useEffect(() => {
    for (const a of p.assets) {
      if (imgs.has(a.id) || loading.current.has(a.id)) continue;
      loading.current.add(a.id);
      const im = new Image();
      im.onload = () => setImgs(m => new Map(m).set(a.id, im));
      im.src = a.src;
    }
  }, [p.assets, imgs]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c) return;
      const L = renderLayers(p, imgs, PREVIEW_PPI);
      layersRef.current = L;
      paint(c, view, L, p, rot, p.subjects.find(s => s.id === sel) ?? null, imgs);
    });
    return () => cancelAnimationFrame(id);
  }, [p, imgs, view, rot, sel]);

  const patch = (q: Partial<Project>) => setP(o => ({ ...o, ...q }));
  const patchSubject = (id: string, q: Partial<Subject>) =>
    setP(o => ({ ...o, subjects: o.subjects.map(s => (s.id === id ? { ...s, ...q } : s)) }));
  const patchMotif = (id: string, q: Partial<Motif>) =>
    setP(o => ({ ...o, motifs: o.motifs.map(m => (m.id === id ? { ...m, ...q } : m)) }));
  const move = <T extends { id: string }>(list: T[], id: string, d: number) => {
    const i = list.findIndex(x => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const n = list.slice(); [n[i], n[j]] = [n[j]!, n[i]!]; return n;
  };

  const chooseTemplate = (id: string) => {
    const t = templateById(id);
    patch({ templateId: t.id, widthIn: t.widthIn, heightIn: t.heightIn, seamless: t.seamless });
  };

  const addArtwork = (a: Omit<Asset, 'id'>, use: ArtworkUse) => {
    const asset: Asset = { ...a, id: uid() };
    if (use === 'subject') {
      const s = newSubject(asset.id);
      setP(o => ({ ...o, assets: [...o.assets, asset], subjects: [...o.subjects, s] }));
      setSel(s.id);
    } else {
      const m: Motif = { ...newMotif('scatter'), assetId: asset.id };
      setP(o => ({ ...o, assets: [...o.assets, asset], motifs: [...o.motifs, m] }));
      setSel(m.id);
    }
    setCutting(null);
  };

  const addMotif = (type: MotifType) => {
    const m = newMotif(type);
    if (type === 'scatter') m.assetId = p.assets[0]?.id;
    setP(o => ({ ...o, motifs: [...o.motifs, m] }));
    setSel(m.id);
  };

  const pruneAssets = (o: Project): Project => {
    const used = new Set([...o.subjects.map(s => s.assetId), ...o.motifs.map(m => m.assetId)]);
    return { ...o, assets: o.assets.filter(a => used.has(a.id)) };
  };

  const toWrap = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const editable = view !== 'seam' && view !== 'barrel';

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const L = layersRef.current;
    if (!editable || !L) return;
    const { x, y } = toWrap(e);
    const hit = [...p.subjects].reverse().find(s => {
      const img = imgs.get(s.assetId);
      if (!img) return false;
      const hh = s.h * L.H, ww = (hh * img.width) / img.height, a = (-s.rot * Math.PI) / 180;
      return (p.seamless ? [-L.W, 0, L.W] : [0]).some(dx => {
        const lx = x - (s.cx * L.W + dx), ly = y - s.cy * L.H;
        const rx = lx * Math.cos(a) - ly * Math.sin(a), ry = lx * Math.sin(a) + ly * Math.cos(a);
        return Math.abs(rx) <= ww / 2 && Math.abs(ry) <= hh / 2;
      });
    });
    if (!hit) return;
    setSel(hit.id);
    drag.current = { id: hit.id, x, y, cx: hit.cx, cy: hit.cy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current, L = layersRef.current;
    if (!d || !L) return;
    const { x, y } = toWrap(e);
    const cx = d.cx + (x - d.x) / L.W;
    patchSubject(d.id, { cx: p.seamless ? mod(cx, 1) : clamp(cx, 0, 1), cy: clamp(d.cy + (y - d.y) / L.H, -0.3, 1.3) });
  };
  const onUp = () => { drag.current = null; };

  const settle = () => new Promise(r => setTimeout(r, 30));
  const doExport = async (kind: Proof) => {
    setBusy(kind); await settle();
    try { download(await exportLayer(p, imgs, kind, whiteFmt), `${slug(p.name)}-${kind}.png`); }
    finally { setBusy(null); }
  };
  const exportAll = async () => {
    for (const k of ['color', 'white', 'day', 'night'] as Proof[]) await doExport(k);
  };
  const submit = async () => {
    if (!onSubmit) return;
    setBusy('submit'); await settle();
    try { await onSubmit(p, await exportLayer(p, imgs, 'day')); flash('Design sent'); }
    finally { setBusy(null); }
  };

  const save = async () => {
    try { await saveProject(p); flash('Saved in this browser'); }
    catch { flash('Could not save. Try Download file instead.'); }
  };
  const openSaved = async () => setSaved(await listProjects());
  const load = (q: Project) => { setP(q); setSel(null); setSaved(null); };
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { load(parseProject(await f.text())); } catch (err) { flash((err as Error).message); }
  };

  const selSubject = p.subjects.find(s => s.id === sel);
  const selMotif = p.motifs.find(m => m.id === sel);
  const assetName = (id?: string) => p.assets.find(a => a.id === id)?.name ?? 'Missing artwork';
  const views: View[] = staff ? ['day', 'color', 'white', 'night', 'seam', 'barrel'] : ['day', 'night', 'seam', 'barrel'];
  const px = (inch: number) => Math.round(inch * p.dpi);

  return (
    <div className="ws">
      <header className="ws-top">
        <div className="ws-brand">Wrap Studio</div>
        <input className="ws-name" value={p.name} onChange={e => patch({ name: e.target.value })} aria-label="Project name" />
        <div className="ws-row">
          <button className="ws-btn ghost" onClick={() => { load(newProject(p.templateId)); }}>New</button>
          <button className="ws-btn ghost" onClick={openSaved}>Open</button>
          <button className="ws-btn ghost" onClick={save}>Save</button>
          <button className="ws-btn ghost" onClick={() => download(new Blob([JSON.stringify(p)], { type: 'application/json' }), `${slug(p.name)}.wrap.json`)}>Download file</button>
          <label className="ws-btn ghost">
            Load file
            <input type="file" accept=".json,application/json" hidden onChange={importFile} />
          </label>
        </div>
      </header>

      <div className="ws-body">
        <aside className="ws-side">
          <Section title="Product">
            <select className="ws-select" value={p.templateId} onChange={e => chooseTemplate(e.target.value)}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="ws-grid2">
              <label className="ws-num">Width in<input type="number" step="0.05" min="1" value={p.widthIn} onChange={e => patch({ widthIn: parseFloat(e.target.value) || p.widthIn, templateId: 'custom' })} /></label>
              <label className="ws-num">Height in<input type="number" step="0.05" min="1" value={p.heightIn} onChange={e => patch({ heightIn: parseFloat(e.target.value) || p.heightIn, templateId: 'custom' })} /></label>
            </div>
            <p className="ws-meta">{px(p.widthIn)} × {px(p.heightIn)} px @ {p.dpi} DPI</p>
            <Toggle label="Seamless wrap" hint="Artwork continues across the seam." checked={p.seamless} onChange={v => patch({ seamless: v })} />
          </Section>

          <Section title="Artwork" action={
            <label className="ws-btn small">
              Upload
              <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCutting(f); }} />
            </label>
          }>
            {p.subjects.length === 0 && <p className="ws-hint">Upload a character or logo. The background is removed next.</p>}
            <ul className="ws-list">
              {p.subjects.map(s => (
                <li key={s.id} className={s.id === sel ? 'on' : ''} onClick={() => setSel(s.id)}>
                  <span>{assetName(s.assetId)}</span>
                  <span className="ws-tag">{s.underbase ? 'on white' : 'tint only'}</span>
                </li>
              ))}
            </ul>
            {selSubject && (
              <div className="ws-inspect">
                <Range label="Height" value={selSubject.h} min={0.1} max={1.4} onChange={v => patchSubject(selSubject.id, { h: v })} fmt={pct} />
                <Range label="Across" value={selSubject.cx} min={0} max={1} step={0.005} onChange={v => patchSubject(selSubject.id, { cx: v })} fmt={pct} />
                <Range label="Up / down" value={selSubject.cy} min={-0.3} max={1.3} step={0.005} onChange={v => patchSubject(selSubject.id, { cy: v })} fmt={pct} />
                <Range label="Rotation" value={selSubject.rot} min={-180} max={180} step={1} onChange={v => patchSubject(selSubject.id, { rot: v })} fmt={v => `${v}°`} />
                <Range label="Opacity" value={selSubject.opacity} min={0.05} max={1} onChange={v => patchSubject(selSubject.id, { opacity: v })} fmt={pct} />
                <Toggle label="Mirror" checked={selSubject.flip} onChange={v => patchSubject(selSubject.id, { flip: v })} />
                <Toggle label="Print on white underbase" hint="On: opaque, reads as a silhouette in the dark. Off: tint only, glows through." checked={selSubject.underbase} onChange={v => patchSubject(selSubject.id, { underbase: v })} />
                <div className="ws-row">
                  <button className="ws-btn small ghost" onClick={() => setP(o => ({ ...o, subjects: move(o.subjects, selSubject.id, 1) }))}>Bring forward</button>
                  <button className="ws-btn small ghost" onClick={() => setP(o => ({ ...o, subjects: move(o.subjects, selSubject.id, -1) }))}>Send back</button>
                  <button className="ws-btn small ghost danger" onClick={() => { setP(o => pruneAssets({ ...o, subjects: o.subjects.filter(s => s.id !== selSubject.id) })); setSel(null); }}>Remove</button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Motifs">
            <p className="ws-hint">Motifs print tint-only, so the substrate glows through them.</p>
            <div className="ws-chips">
              {(Object.keys(MOTIF_LABELS) as MotifType[]).map(t => (
                <button key={t} className="ws-chip" disabled={t === 'scatter' && p.assets.length === 0} onClick={() => addMotif(t)}>+ {MOTIF_LABELS[t]}</button>
              ))}
            </div>
            <ul className="ws-list">
              {p.motifs.map(m => (
                <li key={m.id} className={m.id === sel ? 'on' : ''} onClick={() => setSel(m.id)}>
                  <span style={{ opacity: m.visible ? 1 : 0.45 }}>{MOTIF_LABELS[m.type]}</span>
                  <button className="ws-link" onClick={e => { e.stopPropagation(); patchMotif(m.id, { visible: !m.visible }); }}>{m.visible ? 'Hide' : 'Show'}</button>
                </li>
              ))}
            </ul>
            {selMotif && (
              <div className="ws-inspect">
                {selMotif.type === 'scatter' ? (
                  <select className="ws-select" value={selMotif.assetId ?? ''} onChange={e => patchMotif(selMotif.id, { assetId: e.target.value })}>
                    {p.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : (
                  <ColorField label="Ink" value={selMotif.color} onChange={v => patchMotif(selMotif.id, { color: v })} />
                )}
                <Range label="Strength" value={selMotif.opacity} min={0.05} max={1} onChange={v => patchMotif(selMotif.id, { opacity: v })} fmt={pct} />
                <Range label={selMotif.type === 'halo' ? 'Ring width' : selMotif.type === 'bands' ? 'Studs' : 'Density'} value={selMotif.density} min={0} max={1} onChange={v => patchMotif(selMotif.id, { density: v })} fmt={pct} />
                <Range label="Size" value={selMotif.size} min={0.1} max={1.5} onChange={v => patchMotif(selMotif.id, { size: v })} fmt={pct} />
                {(selMotif.type === 'halo' || selMotif.type === 'rays') && (
                  <>
                    <Range label="Centre across" value={selMotif.cx} min={0} max={1} step={0.005} onChange={v => patchMotif(selMotif.id, { cx: v })} fmt={pct} />
                    <Range label="Centre up / down" value={selMotif.cy} min={0} max={1} step={0.005} onChange={v => patchMotif(selMotif.id, { cy: v })} fmt={pct} />
                  </>
                )}
                <div className="ws-row">
                  {selMotif.type !== 'bands' && selMotif.type !== 'halo' && (
                    <button className="ws-btn small ghost" onClick={() => patchMotif(selMotif.id, { seed: Math.floor(Math.random() * 1e9) })}>Reshuffle</button>
                  )}
                  <button className="ws-btn small ghost danger" onClick={() => { setP(o => pruneAssets({ ...o, motifs: o.motifs.filter(m => m.id !== selMotif.id) })); setSel(null); }}>Remove</button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Substrate">
            <ColorField label="Tumbler colour" value={p.substrate} onChange={v => patch({ substrate: v })} />
            <ColorField label="Glow colour" value={p.glow} onChange={v => patch({ glow: v })} />
            {staff && <Range label="Underbase choke" value={p.chokePx} min={0} max={8} step={1} onChange={v => patch({ chokePx: v })} fmt={v => `${v}px`} />}
          </Section>

          <Section title="Export">
            {staff ? (
              <>
                <div className="ws-seg">
                  <button className={whiteFmt === 'transparent' ? 'on' : ''} onClick={() => setWhiteFmt('transparent')}>White on clear</button>
                  <button className={whiteFmt === 'black' ? 'on' : ''} onClick={() => setWhiteFmt('black')}>Black on white</button>
                </div>
                <div className="ws-stack">
                  {(['color', 'white', 'day', 'night'] as Proof[]).map(k => (
                    <button key={k} className="ws-btn" disabled={!!busy} onClick={() => doExport(k)}>{busy === k ? 'Rendering…' : EXPORT_LABELS[k]}</button>
                  ))}
                  <button className="ws-btn primary" disabled={!!busy} onClick={exportAll}>Export all four</button>
                </div>
                <p className="ws-meta">PNG, {px(p.widthIn)} × {px(p.heightIn)} px, tagged {p.dpi} DPI</p>
              </>
            ) : (
              <div className="ws-stack">
                <button className="ws-btn" disabled={!!busy} onClick={() => doExport('day')}>{busy === 'day' ? 'Rendering…' : 'Download proof'}</button>
                {onSubmit && <button className="ws-btn primary" disabled={!!busy || p.subjects.length === 0} onClick={submit}>{busy === 'submit' ? 'Sending…' : 'Send design'}</button>}
              </div>
            )}
          </Section>
        </aside>

        <main className="ws-stage">
          <div className="ws-tabs" role="tablist">
            {views.map(v => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{VIEW_LABELS[v]}</button>
            ))}
          </div>
          <div className={`ws-canvas-wrap ${view === 'color' ? 'ws-checker' : ''}`}>
            <canvas
              ref={canvasRef}
              className={`ws-canvas ${view === 'barrel' ? 'barrel' : ''}`}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ cursor: editable && p.subjects.length ? 'grab' : 'default' }}
            />
          </div>
          {view === 'barrel' && (
            <div className="ws-turn"><Range label="Turn" value={rot} min={0} max={1} step={0.005} onChange={setRot} fmt={v => `${Math.round(v * 360)}°`} /></div>
          )}
          <p className="ws-hint">{VIEW_HINTS[view]}</p>
        </main>
      </div>

      {cutting && <CutoutPanel file={cutting} allowChips={true} onCancel={() => setCutting(null)} onDone={addArtwork} />}

      {saved && (
        <div className="ws-modal" onClick={() => setSaved(null)}>
          <div className="ws-modal-card ws-open" onClick={e => e.stopPropagation()}>
            <h2>Saved in this browser</h2>
            {saved.length === 0 && <p className="ws-hint">Nothing saved yet.</p>}
            <ul className="ws-list">
              {saved.map(s => (
                <li key={s.id} onClick={() => load(s.project)}>
                  <span>{s.name}</span>
                  <span className="ws-row">
                    <span className="ws-tag">{new Date(s.updated).toLocaleDateString()}</span>
                    <button className="ws-link" onClick={async e => { e.stopPropagation(); await deleteProject(s.id); setSaved(await listProjects()); }}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="ws-row ws-end"><button className="ws-btn ghost" onClick={() => setSaved(null)}>Close</button></div>
          </div>
        </div>
      )}

      {notice && <div className="ws-toast">{notice}</div>}
    </div>
  );
}
