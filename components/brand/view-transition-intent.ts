/*
 * Pure predicate for the morph-link click handler — extracted so the
 * "should this click become an in-app view-transition nav, or be left to
 * the browser?" decision is unit-testable without a DOM.
 *
 * A click must fall through to default browser behavior when the user is
 * trying to open a new tab/window (modifier keys), used a non-primary
 * button (middle = new tab, right = context menu), or some earlier handler
 * already claimed the event. Only a plain primary-button click should be
 * hijacked into a client-side view transition.
 */

export interface ClickIntent {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export function shouldInterceptClick(e: ClickIntent): boolean {
  if (e.defaultPrevented) return false;
  if (e.button !== 0) return false;
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
}
