// The dedicated full-screen voice surface. The persistent Curly orb (mounted in
// the root layout) overlays this and renders the reactive stage. Server
// component — auth is already enforced by proxy.ts.
export default function SurfacePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center" aria-label="Curly voice surface">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">tap the orb and talk</p>
    </div>
  );
}
