import { useEffect, useRef, useState } from "preact/hooks";

export interface DataState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/**
 * Runs `load` when `deps` change and again every `refreshMs(data)` milliseconds
 * (return 0 to stop polling). Keeps showing the previous data while refreshing.
 */
export function useData<T>(load: () => Promise<T>, deps: unknown[], refreshMs?: (data: T | undefined) => number): DataState<T> {
  const [state, setState] = useState<DataState<T>>({ data: undefined, error: undefined, loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState((s) => ({ ...s, data: undefined, loading: true }));

    const run = async () => {
      let data: T | undefined;
      try {
        data = await loadRef.current();
        if (alive) setState({ data, error: undefined, loading: false });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: e as Error, loading: false }));
      }
      const next = refreshMs?.(data) ?? 0;
      if (alive && next > 0) timer = setTimeout(run, next);
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, deps);

  return state;
}

/** Re-renders every `ms` (for ticking live minutes). */
export function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
