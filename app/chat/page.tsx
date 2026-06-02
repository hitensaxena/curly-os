import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Every visit to /chat mints a fresh per-tab id and redirects. The id is
// throwaway until the first turn — claude mints its own real session_id,
// which the client then reconciles into the URL.
export default function ChatIndexPage() {
  redirect(`/chat/${randomUUID()}`);
}
