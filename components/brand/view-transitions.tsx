"use client";

/*
 * View-transition navigation glue.
 *
 * The browser's View Transitions API only animates if a navigation runs
 * inside document.startViewTransition(). Next's App Router doesn't wrap
 * client navigations itself — React's <ViewTransition> would, but the
 * installed React build doesn't ship it — so we drive the API by hand.
 *
 * The hard part is timing: a route change is async (the RSC payload has to
 * arrive), but startViewTransition snapshots the "new" DOM as soon as its
 * callback's promise resolves. Resolve too early and the API captures the
 * old page. So <ViewTransitions> sits near the root and releases the
 * in-flight transition only once the navigation has committed (pathname
 * changed); useViewTransitionRouter hands it the resolver.
 *
 * Elements that share a CSS view-transition-name across the two pages — a
 * product card image and the PDP hero — morph between their boxes; the rest
 * cross-fades. Unsupported browsers, reduced-motion users, and same-page
 * links fall straight through to an instant push (no transition).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

import { shouldInterceptClick } from "./view-transition-intent";

type Resolver = (() => void) | null;
const PendingNavigation = createContext<{ current: Resolver }>({ current: null });

export function ViewTransitions({ children }: { children: ReactNode }) {
  const pending = useRef<Resolver>(null);
  const pathname = usePathname();

  useEffect(() => {
    // A navigation just committed — release the transition so it captures
    // the new DOM. No-op on first mount and on pushes made without a
    // transition (pending stays null).
    pending.current?.();
    pending.current = null;
  }, [pathname]);

  return (
    <PendingNavigation.Provider value={pending}>
      {children}
    </PendingNavigation.Provider>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useViewTransitionRouter(): (href: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useContext(PendingNavigation);

  return useCallback(
    (href: string) => {
      const target = href.split(/[?#]/)[0];
      if (
        target === pathname ||
        typeof document === "undefined" ||
        !document.startViewTransition ||
        prefersReducedMotion()
      ) {
        router.push(href);
        return;
      }
      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            // Released by <ViewTransitions> once the new route commits. The
            // guard keeps a failed/no-op nav from freezing the old snapshot
            // for the API's full 4s default.
            const guard = window.setTimeout(resolve, 700);
            pending.current = () => {
              window.clearTimeout(guard);
              resolve();
            };
            router.push(href);
          }),
      );
    },
    [router, pathname, pending],
  );
}

export function MorphLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const navigate = useViewTransitionRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (typeof href !== "string" || !shouldInterceptClick(e)) return;
    e.preventDefault();
    navigate(href);
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
