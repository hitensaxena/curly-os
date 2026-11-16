import { redirect } from "next/navigation";

// The voice surface was a prompt to "tap the orb", and the orb no longer
// exists. Kept as a redirect so old bookmarks do not 404.
export default function Page() {
  redirect("/");
}
