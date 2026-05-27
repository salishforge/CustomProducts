/*
 * Admin form primitives.
 *
 * Hand-built, no shadcn install yet — the admin keeps a deliberately quiet
 * register. Label-above-input pattern, mono labels, hairline-bordered
 * inputs, paper-200 wells on focus.
 */

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]"
      >
        {label}
        {required ? <span className="text-[color:var(--color-ember-700)] ml-1">*</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="text-xs text-[color:var(--color-ink-600)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-[color:var(--color-ember-700)]">{error}</p>
      ) : null}
    </div>
  );
}

const baseInputClass =
  "w-full px-3 py-2 bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] text-[color:var(--color-ink-950)] text-sm focus:outline-none focus:border-[color:var(--color-ink-800)] focus:bg-white transition-colors";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${baseInputClass} ${props.className ?? ""}`} />;
}

export function NumberInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      type="number"
      {...props}
      className={`${baseInputClass} nums-tabular ${props.className ?? ""}`}
    />
  );
}

export function SelectInput({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${baseInputClass} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${baseInputClass} resize-y min-h-[6rem] ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center px-5 py-2.5 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] active:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center px-5 py-2.5 border border-[color:var(--color-paper-300)] hover:border-[color:var(--color-ink-800)] text-[color:var(--color-ink-800)] font-mono text-xs uppercase tracking-[0.22em] active:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
