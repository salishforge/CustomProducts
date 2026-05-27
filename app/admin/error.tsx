"use client";

import Link from "next/link";
import { useEffect } from "react";

/*
 * Admin error boundary.
 *
 * Catches thrown Server Action errors (including AdminValidationError) and
 * renders a coarse message. Phase 2a accepts this UX; field-level error
 * surfacing lands in a follow-up using useActionState on each form.
 */

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error]", error);
  }, [error]);

  return (
    <div className="max-w-xl">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ember-700)]">
        Something went wrong
      </p>
      <h1
        className="mt-2 font-display text-3xl leading-[1.1]"
        style={{ fontVariationSettings: '"opsz" 40, "wght" 420' }}
      >
        The press jammed.
      </h1>
      <p className="mt-4 text-sm text-[color:var(--color-ink-800)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center px-5 py-2.5 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
