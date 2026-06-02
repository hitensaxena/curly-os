import { AppDock } from "@/components/shell/AppDock";

// Persistent OS chrome: a left dock + scrollable main. The global CurlyOrb and
// CommandPalette live in the root layout, so they overlay every shell route.
// /surface, /chat and /forbidden sit OUTSIDE this group (their own full-bleed
// layouts). pb-28 keeps content clear of the bottom-center orb button.
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <AppDock />
      <main className="min-w-0 flex-1 pb-28">{children}</main>
    </div>
  );
}
