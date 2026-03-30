export function createHistoryStore<T>(options: {
  key: string;
  limit: number;
  validate: (item: unknown) => item is T;
  dedupKey: (item: T) => string;
}) {
  function read(): T[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(options.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(options.validate);
    } catch {
      return [];
    }
  }

  function write(items: T[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(options.key, JSON.stringify(items));
  }

  function push(items: T[], entry: T): T[] {
    return [entry, ...items.filter((item) => options.dedupKey(item) !== options.dedupKey(entry))].slice(0, options.limit);
  }

  return { read, write, push };
}
