"use client";

import { useSyncExternalStore } from "react";

/** The store never changes, so the subscribe callback has nothing to do. */
const subscribe = () => () => {};

/**
 * `false` during server rendering and the first client render, `true` after
 * hydration.
 *
 * Anything that depends on the browser — the OS colour-scheme preference, a
 * value `next-themes` reads out of localStorage — cannot be known on the server.
 * Rendering it immediately would produce a hydration mismatch; deferring it with
 * `useState` + `useEffect` would set state inside an effect and trigger a
 * cascading render. `useSyncExternalStore` expresses exactly this with a
 * different server and client snapshot, and no effect at all.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
