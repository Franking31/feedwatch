"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto mt-20 max-w-sm p-4 text-center">
      <h1 className="mb-3 text-xl font-bold">Oups, une erreur est survenue</h1>
      <button onClick={reset} className="rounded border px-3 py-2">
        Réessayer
      </button>
    </main>
  );
}