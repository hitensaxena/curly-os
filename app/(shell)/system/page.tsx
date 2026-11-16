"use client";

// System: health, engines, settings and logs in one place, as tabs. These were
// three separate destinations plus the stats tiles that used to sit on the home
// page.

import SettingsPanel from "@/components/system/SettingsPanel";
import HealthPanel from "@/components/system/HealthPanel";
import LogsPanel from "@/components/system/LogsPanel";
import { useEffect, useState } from "react";

type Tab = "health" | "settings" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "health", label: "Health & engines" },
  { id: "settings", label: "Settings" },
  { id: "logs", label: "Logs" },
];

export default function SystemPage() {
  const [tab, setTab] = useState<Tab>("health");

  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);

  return (
    <div>
      <div className="border-b border-border px-5 pt-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="mb-1 text-2xl font-bold text-foreground">System</h1>
          <p className="mb-4 text-sm text-muted">Health, autonomous engines, configuration and logs.</p>
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === t.id
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The tab components already render their own max-width container. */}
      {tab === "health" && <HealthPanel />}
      {tab === "settings" && <SettingsPanel />}
      {tab === "logs" && <LogsPanel />}
    </div>
  );
}
