import { useEffect, useState, type MouseEvent } from "react";

// Hash routes:  #/            home
//               #/t/:tag      a subject
//               #/t/:tag/:id  a photo, browsing within a subject
//               #/p/:id       a photo on its own

const parse = () =>
  location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

const scrollPositions = new Map<string, number>();
let inAppDepth = 0; // how many in-app pages we can safely history.back() through
history.scrollRestoration = "manual";
window.addEventListener("popstate", () => { inAppDepth = Math.max(0, inAppDepth - 1); });

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    let current = location.hash;
    const onChange = () => {
      scrollPositions.set(current, window.scrollY);
      current = location.hash;
      setRoute(parse());
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollPositions.get(current) ?? 0)));
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href = (...parts: string[]) =>
  "#/" + parts.map(encodeURIComponent).join("/");

/** Follow a link, remembering that "back" now stays inside the site. */
export function go(to: string) {
  inAppDepth++;
  location.hash = to.slice(1);
}

/** Swap the current page without adding a history entry (photo → next photo). */
export function swap(to: string) {
  location.replace(to);
}

/** Go back if we came from inside the site, otherwise go to `fallback`. */
export function back(fallback: string) {
  if (inAppDepth > 0) history.back();
  else location.replace(fallback);
}

export function onLinkClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(e.currentTarget.getAttribute("href")!);
}
