import { useLayoutEffect } from "react";
import { useNavigationType } from "react-router-dom";

const SEARCH_SCROLL_STORAGE_KEY = "book-echo-search-scroll";

function getScrollStorageKey(key: string) {
  return `${SEARCH_SCROLL_STORAGE_KEY}:${key || "root"}`;
}

export function useSearchScrollRestoration(searchKey: string) {
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType !== "POP" || !searchKey) {
      return;
    }

    const saved = window.sessionStorage.getItem(getScrollStorageKey(searchKey));
    if (!saved) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(saved), behavior: "auto" });
    });
  }, [navigationType, searchKey]);

  useLayoutEffect(() => {
    if (!searchKey) {
      return;
    }

    const storageKey = getScrollStorageKey(searchKey);
    const persistScroll = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };

    window.addEventListener("scroll", persistScroll, { passive: true });

    return () => {
      persistScroll();
      window.removeEventListener("scroll", persistScroll);
    };
  }, [searchKey]);
}
