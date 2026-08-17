export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">chat-chassis</h1>
      <p className="text-neutral-600">
        See <code>/demo</code> for the chat widget mounted with the example config, and
        docs/SETUP.md to wire in a real project.
      </p>
    </main>
  );
}
