import { AppDock } from "@/components/shell/AppDock";

// Shared chrome wrapper: left dock + main. Used by both the (shell) route group
// and the standalone /chat and /surface routes that live outside it.
//
// Non-full-height routes scroll the window and reserve --orb-clearance at the
// bottom so the floating orb never covers content. Full-height routes (chat,
// surface) pin to the dynamic viewport height (h-dvh) as a *definite*-height
// flex column, so their child manages its own internal scroll (chat's message
// list) or centers in the viewport (the surface stage) instead of growing the
// page and pushing the sticky input/stage past the fold.
export function ShellFrame({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  return (
    <div
      className={
        fullHeight ? "flex h-dvh w-full overflow-hidden" : "flex min-h-screen w-full"
      }
    >
      <AppDock />
      <main
        className={
          fullHeight
            ? "flex min-w-0 flex-1 flex-col overflow-hidden"
            : "min-w-0 flex-1"
        }
        style={fullHeight ? undefined : { paddingBottom: "var(--orb-clearance)" }}
      >
        {children}
      </main>
    </div>
  );
}
