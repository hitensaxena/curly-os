import { ShellFrame } from "@/components/shell/ShellFrame";

// Persistent OS chrome for the (shell) route group. The global CurlyOrb and
// CommandPalette live in the root layout so they overlay every shell route.
// ShellFrame handles the left dock + main with orb clearance.
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellFrame>{children}</ShellFrame>;
}
