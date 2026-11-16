import { Rail } from "@/components/shell/Rail";
import { TopBar } from "@/components/shell/TopBar";

// The shell: a fixed rail, one search field, and the page. No floating orb,
// voice panel or popover menu layered over every screen — those made a memory
// browser feel like an app you had to learn.
export function ShellFrame({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  return (
    <div className="min-h-screen w-full md:pl-52">
      <Rail />
      <div className="flex min-h-screen flex-col pb-14 md:pb-0">
        <TopBar />
        {fullHeight ? (
          <main className="flex flex-1 flex-col overflow-hidden" style={{ height: "calc(100dvh - 57px)" }}>
            {children}
          </main>
        ) : (
          <main className="flex-1">{children}</main>
        )}
      </div>
    </div>
  );
}
