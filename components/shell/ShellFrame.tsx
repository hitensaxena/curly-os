// Shell content frame. Navigation + Curly now live in the bottom Curly bar
// (the Omnibar spine, mounted globally in the root layout), so the frame is just
// the content region — full-bleed — reserving the spine's height at the bottom.
//
// Non-full-height routes scroll the window with bottom padding so the last
// content clears the fixed spine. Full-height routes (chat, surface) get a
// definite height of (100dvh - spine) so their own internal scroll / centering
// sits cleanly ABOVE the spine instead of being covered by it.
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
        className="flex w-full flex-col overflow-hidden"
        style={{ height: "calc(100dvh - var(--spine-h))" }}
      >
        {children}
      </main>
    );
  }
  return (
    <main className="min-h-screen w-full" style={{ paddingBottom: "var(--spine-h)" }}>
      {children}
    </main>
  );
}
