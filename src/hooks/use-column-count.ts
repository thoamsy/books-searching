import { useEffect, useState, type RefObject } from "react";

const BREAKPOINTS: [number, number][] = [
  [1280, 5], // xl
  [1024, 4], // lg
  [640, 3],  // sm
];
const DEFAULT_COLUMNS = 2;

export function useColumnCount(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const cols =
        BREAKPOINTS.find(([bp]) => width >= bp)?.[1] ?? DEFAULT_COLUMNS;
      setColumns(cols);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
