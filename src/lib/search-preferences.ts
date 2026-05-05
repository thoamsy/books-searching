import { useCallback, useEffect, useState } from "react";

const SEARCH_AUTO_FOCUS_KEY = "opus:search-auto-focus";
const SEARCH_AUTO_FOCUS_EVENT = "opus:search-auto-focus-change";

export function readSearchAutoFocusPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SEARCH_AUTO_FOCUS_KEY) === "true";
}

export function writeSearchAutoFocusPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEARCH_AUTO_FOCUS_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(SEARCH_AUTO_FOCUS_EVENT, { detail: enabled }));
}

export function useSearchAutoFocusPreference() {
  const [enabled, setEnabledState] = useState(readSearchAutoFocusPreference);

  useEffect(() => {
    function sync() {
      setEnabledState(readSearchAutoFocusPreference());
    }

    window.addEventListener("storage", sync);
    window.addEventListener(SEARCH_AUTO_FOCUS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SEARCH_AUTO_FOCUS_EVENT, sync);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    writeSearchAutoFocusPreference(next);
    setEnabledState(next);
  }, []);

  return [enabled, setEnabled] as const;
}
