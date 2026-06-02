export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-foreground text-glow">Not for you</h1>
        <p className="mt-2 text-muted">This Curly OS instance is private.</p>
      </div>
    </main>
  );
}
