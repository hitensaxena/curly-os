"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

// Create the project's vault folder (from the 7-file template) for a registry
// entry that doesn't have one yet — keeps the existing slug.
export function ScaffoldButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function scaffold() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, slug }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={() => void scaffold()} disabled={busy}>
      {busy ? "Creating…" : "Scaffold project folder"}
    </Button>
  );
}
