"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";

// A single gentle nudge per day, derived from the briefing. Debounced via
// localStorage (same pattern as ChatWindow's THINK_PREF_KEY) so it never nags.
export function BriefingNudge({
  journaledToday,
  staleCount,
}: {
  journaledToday: boolean;
  staleCount: number;
}) {
  const toast = useToast();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `curly:nudge:${new Date().toISOString().slice(0, 10)}`;
    if (window.localStorage.getItem(key)) return;
    if (!journaledToday) {
      toast.info("You haven’t journaled today — press ⌘K and type “+ …”.");
      window.localStorage.setItem(key, "1");
    } else if (staleCount > 0) {
      toast.info(`${staleCount} open task${staleCount > 1 ? "s" : ""} waiting in your projects.`);
      window.localStorage.setItem(key, "1");
    }
    // run once on mount; toast/values are stable for this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
