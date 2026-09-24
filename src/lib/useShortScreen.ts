import { useSyncExternalStore } from "react";

/** Same breakpoint as the `short:` Tailwind variant in globals.css. */
const QUERY = "(max-height: 820px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Laptop-height screen: for sizes CSS can't reach, like pixel sprite scales. */
export function useShortScreen() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
