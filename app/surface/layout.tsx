import { ShellFrame } from "@/components/shell/ShellFrame";

// Surface sits outside the (shell) route group, so it would otherwise inherit
// no dock. This layout adds the shared chrome (dock + full-height main) so
// /surface renders with the left dock like other OS routes.
export default function SurfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellFrame fullHeight>{children}</ShellFrame>;
}
