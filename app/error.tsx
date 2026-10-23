"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="mb-4 mt-2 text-muted">
        La page n'a pas pu s'afficher. Réessaie, et si ça continue, reviens un peu plus tard.
      </p>
      <button onClick={reset} className="btn btn-primary self-start">
        Réessayer
      </button>
    </main>
  );
}