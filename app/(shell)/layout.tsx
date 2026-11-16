import { ShellFrame } from "@/components/shell/ShellFrame";

// Shell for the four primary surfaces. Navigation is a fixed rail and a single
// search field (ShellFrame); the command palette remains global for ⌘K.
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellFrame>{children}</ShellFrame>;
}
