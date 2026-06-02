"use client";

import { useEffect, useRef, useState } from "react";

type Opts = { delayMs?: number; minLen?: number };

type State<T> = {
  q: string;
  result: T | null;
  searching: boolean;
};

/**
 * Debounce a query against a fetcher, returning the latest result plus a
 * searching flag. State transitions happen inside the timeout callback or
 * promise handlers — never synchronously in the effect body — so React 19
 * strict mode does not flag set-state-in-effect.
 *
 * The fetcher must handle its own errors (return a default T variant rather
 * than throwing); rejections that aren't AbortErrors clear the result.
 */
export function useDebouncedSearch<T>(
  query: string,
  fetcher: (q: string, signal: AbortSignal) => Promise<T>,
  opts: Opts = {},
): { result: T | null; searching: boolean } {
  const { delayMs = 250, minLen = 2 } = opts;
  const trimmed = query.trim();
  const valid = trimmed.length >= minLen;

  const [state, setState] = useState<State<T>>({
    q: "",
    result: null,
    searching: false,
  });

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setState((s) => ({ ...s, searching: true }));
      fetcherRef.current(trimmed, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          setState({ q: trimmed, result: r, searching: false });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if ((err as Error)?.name === "AbortError") return;
          setState({ q: trimmed, result: null, searching: false });
        });
    }, delayMs);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [trimmed, valid, delayMs]);

  if (!valid) return { result: null, searching: false };
  return {
    result: state.q === trimmed ? state.result : null,
    searching: state.searching || state.q !== trimmed,
  };
}
