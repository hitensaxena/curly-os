import { ShellFrame } from "@/components/shell/ShellFrame";

// Chat routes sit outside the (shell) route group, so they would otherwise
// inherit no dock. This layout adds the shared chrome (dock + full-height
// main) so /chat and /chat/[id] render consistently with other OS routes.
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellFrame fullHeight>{children}</ShellFrame>;
}
