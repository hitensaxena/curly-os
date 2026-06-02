// Shell content frame. Navigation is a floating top-left menu button
// (FloatingNav) and Curly is a floating bottom-right orb — both mounted globally
// in the root layout — so the frame is just the full-bleed content region.
//
// Full-height routes (chat, surface) fill the viewport so their own internal
// scroll / centering works; normal routes scroll the window. On small screens a
// little top padding keeps page headings clear of the floating menu button.
export function ShellFrame({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  if (fullHeight) {
    return (
      <main
        className="flex w-full flex-col overflow-hidden max-sm:pt-14"
        style={{ height: "100dvh" }}
      >
        {children}
      </main>
    );
  }
  return <main className="min-h-screen w-full max-sm:pt-14">{children}</main>;
}
