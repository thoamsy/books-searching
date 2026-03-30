import { useEffect, useState, type RefObject } from "react";

const BREAKPOINTS: [number, number][] = [
  [1024, 5],
  [768, 4],
  [480, 3],
];
const DEFAULT_COLUMNS = 2;

function getColumns(width: number): number {
  return BREAKPOINTS.find(([bp]) => width >= bp)?.[1] ?? DEFAULT_COLUMNS;
}

export function useColumnCount(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(() => getColumns(window.innerWidth));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setColumns(getColumns(entry.contentRect.width));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
