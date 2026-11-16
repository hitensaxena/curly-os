import { redirect } from "next/navigation";

// Search now lives at the top of every screen and on Ask; the Library applies
// the query so old links keep their results.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(q ? `/library?q=${encodeURIComponent(q)}` : "/library");
}
