'use client';
import type { ReactNode } from 'react';

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="ws-section">
      <div className="ws-section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Range({ label, value, min, max, step = 0.01, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label className="ws-range">
      <span className="ws-range-top">
        <span>{label}</span>
        <span className="ws-val">{fmt ? fmt(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="ws-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ws-color">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} />
      <span>{label}</span>
      <span className="ws-val">{value}</span>
    </label>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
