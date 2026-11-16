"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API = "";

type Setting = {
  value: boolean | number | string;
  default: boolean | number | string;
  type: "bool" | "int" | "float" | "str";
  category: string;
  description: string;
  is_default: boolean;
  updated_at: string | null;
};

type Overview = {
  health?: Record<string, { ok?: boolean; model?: string }>;
  counts?: Record<string, number>;
  recall?: { hit_rate?: number; requests?: number; avg_latency_ms?: number };
  pipeline?: {
    backlog?: Record<string, number>;
    ingest_rate?: Record<string, number>;
    knowledge_graph?: Record<string, number>;
  };
  llm?: { tiers?: Record<string, { configured?: boolean; model?: string; calls?: number; errors?: number }> };
  uptime_seconds?: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  recall: "Recall",
  cognition: "Cognition",
  ingest: "Ingest",
};

const CATEGORY_HINT: Record<string, string> = {
  recall: "How retrieval ranks and caches results. Changes apply to the next /api/recall.",
  cognition: "Which autonomous engines run, and how aggressively they scan.",
  ingest: "What happens to a memory the moment it is written.",
};

function title(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fmt(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value ?? "");
}

function SettingRow({
  name,
  setting,
  onSaved,
}: {
  name: string;
  setting: Setting;
  onSaved: (name: string, next: Setting) => void;
}) {
  const [draft, setDraft] = useState<string>(String(setting.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(String(setting.value));
  }, [setting.value]);

  const save = useCallback(
    async (raw: string | boolean) => {
      setBusy(true);
      setError(null);
      try {
        const value =
          setting.type === "bool" ? Boolean(raw) : setting.type === "str" ? String(raw) : Number(raw);
        if (setting.type !== "str" && typeof value === "number" && Number.isNaN(value)) {
          throw new Error("not a number");
        }
        const r = await fetch(`${API}/api/settings/${encodeURIComponent(name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.detail ? String(body.detail) : `HTTP ${r.status}`);
        }
        const next = (await r.json()) as Setting;
        onSaved(name, next);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [name, setting.type, onSaved],
  );

  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-0 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{title(name)}</span>
          {!setting.is_default && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
              changed
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{setting.description}</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {savedAt && !error && <p className="mt-1 text-xs text-accent">saved</p>}
      </div>

      <div className="flex items-center gap-3 sm:w-64 sm:justify-end">
        {setting.type === "bool" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save(!setting.value)}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
              setting.value ? "bg-accent" : "bg-border"
            }`}
            aria-pressed={setting.value === true}
            aria-label={`${title(name)}: ${setting.value ? "on" : "off"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${
                setting.value ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        ) : (
          <input
            type={setting.type === "str" ? "text" : "number"}
            value={draft}
            step={setting.type === "float" ? "0.01" : "1"}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== String(setting.value)) save(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-28 rounded border border-border bg-surface px-2 py-1 text-right text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
            aria-label={title(name)}
          />
        )}
        <span className="w-14 text-right text-[11px] text-muted">
          {setting.is_default ? `default ${fmt(setting.default)}` : fmt(setting.default)}
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const get = (path: string) =>
      fetch(`${API}${path}`, { signal: AbortSignal.timeout(20_000) }).then((r) => {
        if (!r.ok) throw new Error(`${path} → ${r.status}`);
        return r.json();
      });
    Promise.all([get("/api/settings"), get("/api/observability/overview").catch(() => null)])
      .then(([s, o]) => {
        setSettings((s as { settings: Record<string, Setting> }).settings ?? {});
        setOverview(o as Overview | null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  const byCategory = useMemo(() => {
    const groups: Record<string, [string, Setting][]> = {};
    for (const [name, s] of Object.entries(settings)) {
      (groups[s.category] ??= []).push([name, s]);
    }
    for (const list of Object.values(groups)) list.sort((a, b) => a[0].localeCompare(b[0]));
    return groups;
  }, [settings]);

  const onSaved = useCallback((name: string, next: Setting) => {
    setSettings((prev) => ({ ...prev, [name]: { ...prev[name], ...next } }));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted">Loading...</div>;
  if (error)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-foreground">Could not load settings</p>
        <p className="font-mono text-xs text-muted">{error}</p>
      </div>
    );

  const health = overview?.health ?? {};
  const pipeline = overview?.pipeline;
  const recall = overview?.recall;
  const tiers = overview?.llm?.tiers ?? {};

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Settings</h1>
      <p className="mb-6 text-sm text-muted">
        Live configuration, read from and written to the core. Changes take effect on the next request.
      </p>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Postgres", ok: health.postgres?.ok, detail: health.postgres?.ok ? "ok" : "unavailable" },
          { label: "Redis", ok: health.redis?.ok, detail: health.redis?.ok ? "ok" : "unavailable" },
          { label: "Embedder", ok: health.embedder?.ok, detail: health.embedder?.model ?? "—" },
          {
            label: "Recall cache",
            ok: (recall?.hit_rate ?? 0) > 0,
            detail: recall ? `${Math.round((recall.hit_rate ?? 0) * 100)}% hit` : "—",
          },
        ].map((tile) => (
          <div key={tile.label} className="rounded border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${tile.ok ? "bg-accent" : "bg-red-400"}`} />
              <span className="text-xs uppercase tracking-wide text-muted">{tile.label}</span>
            </div>
            <p className="mt-1 truncate text-sm text-foreground">{tile.detail}</p>
          </div>
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded border border-border bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">LLM tiers</p>
          <p className="mt-1 text-sm text-foreground">
            {Object.entries(tiers)
              .filter(([, t]) => t.configured)
              .map(([k]) => k)
              .join(" · ") || "none configured"}
          </p>
        </div>
        <div className="rounded border border-border bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Embedding backlog</p>
          <p className="mt-1 text-sm text-foreground">
            {pipeline ? `${pipeline.backlog?.unembedded_memories ?? 0} memories · ${pipeline.backlog?.unembedded_episodes ?? 0} episodes` : "—"}
          </p>
        </div>
        <div className="rounded border border-border bg-surface p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Ingest (24h)</p>
          <p className="mt-1 text-sm text-foreground">
            {pipeline ? `${pipeline.ingest_rate?.last_24h ?? 0} episodes` : "—"}
          </p>
        </div>
      </section>

      {Object.entries(byCategory).map(([category, list]) => (
        <section key={category} className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {CATEGORY_LABEL[category] ?? title(category)}
          </h2>
          {CATEGORY_HINT[category] && (
            <p className="mb-2 mt-1 text-xs text-muted">{CATEGORY_HINT[category]}</p>
          )}
          <div className="rounded border border-border bg-surface px-4">
            {list.map(([name, setting]) => (
              <SettingRow key={name} name={name} setting={setting} onSaved={onSaved} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
