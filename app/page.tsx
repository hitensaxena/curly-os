import Link from "next/link";
import { brain } from "@/lib/brain";
import { PaletteTrigger } from "@/components/PaletteTrigger";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Live brain status — proves the bridge wiring and gives the home a heartbeat.
  let stats: { nodes: number; chunks: number } | null = null;
  try {
    const s = await brain.stats();
    stats = { nodes: s.nodes, chunks: s.chunks };
  } catch {
    stats = null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted">
          personal os
        </div>
        <h1 className="text-5xl font-semibold text-foreground text-glow">Curly OS</h1>
        <p className="mt-3 text-subtle">
          Chat with Curly. Manage your mind. Explore the brain.
        </p>

        <div className="mt-8">
          <PaletteTrigger />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          <Link
            href="/chat"
            className="rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-accent hover:glow"
          >
            <div className="font-medium text-foreground">Chat with Curly →</div>
            <div className="mt-1 text-xs text-muted">Vault-aware Claude, streaming</div>
          </Link>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="font-medium text-foreground">Brain</div>
            <div className="mt-1 text-xs text-muted">
              {stats
                ? `${stats.nodes.toLocaleString()} nodes · ${stats.chunks.toLocaleString()} chunks`
                : "offline"}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
