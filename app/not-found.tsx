import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold">Page introuvable</h1>
      <p className="mb-4 mt-2 text-muted">Cette adresse n'existe pas ou a changé.</p>
      <Link href="/dashboard/articles" className="btn btn-primary self-start">
        Retour aux articles
      </Link>
    </main>
  );
}