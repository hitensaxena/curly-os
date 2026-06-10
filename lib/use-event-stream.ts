"use client";
// Native EventSource hook for /api/events/stream.
// Auto-reconnects with capped exponential backoff. Cleanup on unmount.

import { useEffect, useRef } from "react";
import type { SseEvent } from "@/lib/curlyos-types";

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export function useEventStream(
  typePrefixes: string[],
  onEvent: (event: SseEvent) => void,
): void {
  // Keep stable callback ref so effect deps don't change on every render.
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  const prefixesKey = typePrefixes.slice().sort().join(",");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typePrefixes.length === 0) return;

    let es: EventSource | null = null;
    let retryDelay = MIN_DELAY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const url = `/api/events/stream?types=${encodeURIComponent(typePrefixes.join(","))}`;
      es = new EventSource(url);

      es.onmessage = (raw) => {
        retryDelay = MIN_DELAY_MS; // reset on successful data
        try {
          const evt = JSON.parse(raw.data) as SseEvent;
          cbRef.current(evt);
        } catch {
          // malformed event — ignore
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (unmounted) return;
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, MAX_DELAY_MS);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefixesKey]);
}
