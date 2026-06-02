import { notFound } from "next/navigation";
import { isVaultDir, listVaultDir, readVaultNote } from "@/lib/vault-fs";
import { getNeighbors } from "@/lib/graph";
import { NotesBrowser } from "@/components/notes/NotesBrowser";
import { NoteReader } from "@/components/notes/NoteReader";
import { NoteEditor } from "@/components/notes/NoteEditor";

export const dynamic = "force-dynamic";

// One catch-all serves three views: a directory → browser; a .md file → reader;
// a writeable .md with ?edit=1 → editor.
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { path } = await params;
  const sp = await searchParams;
  const rel = path.map(decodeURIComponent).join("/");

  if (await isVaultDir(rel)) {
    try {
      const listing = await listVaultDir(rel);
      return <NotesBrowser listing={listing} />;
    } catch {
      notFound();
    }
  }

  const note = await readVaultNote(rel);
  if (!note) notFound();

  if (sp?.edit && note.writeable) return <NoteEditor note={note} />;
  return <NoteReader note={note} neighbors={getNeighbors(rel)} />;
}
