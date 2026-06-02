"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useVoice } from "@/lib/voice/VoiceContext";
import { routeTitle } from "@/lib/voice/route-title";

// Tells Curly what Hiten is looking at: on every route change it records `here`
// in context and (if the orb's socket is open) sends it to the voice backend.
// Renders nothing.
export function RouteBeacon() {
  const pathname = usePathname();
  const v = useVoice();
  useEffect(() => {
    const here = { route: pathname, title: routeTitle(pathname) };
    v._setHere(here);
    v.controls?.sendContext(here);
    // setters are stable; re-run only on route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}
