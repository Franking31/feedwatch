import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  refreshMyFeeds,
  addKeyword,
  deleteKeyword,
  setRead,
  setStarred,
  markAllRead,
} from "../actions";

type View = "all" | "unread" | "starred";
type Params = { folder?: string; q?: string; all?: string; view?: string; limit?: string };

// Construit une adresse en gardant seulement les paramètres utiles
function href(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const query = sp.toString();
  return `/dashboard/articles${query ? `?${query}` : ""}`;
}

// "Le titre OU le résumé contient ce mot" (sans tenir compte des majuscules)
function textMatch(word: string): Prisma.ArticleWhereInput {
  return {
    OR: [
      { title: { contains: word, mode: "insensitive" } },
      { summary: { contains: word, mode: "insensitive" } },
    ],
  };
}

async function Articles({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const { folder, q: rawQ, all, view: rawView, limit: rawLimit } = await searchParams;
  const q = rawQ?.trim().slice(0, 100) || undefined;
  const useFilters = all !== "1";
  const view: View =
    rawView === "unread" || rawView === "starred" ? rawView : "all";
  const viewParam = view === "all" ? undefined : view;

  const [folders, keywords] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.keyword.findMany({
      where: { userId: user.id },
      orderBy: { word: "asc" },
    }),
  ]);

  const includes = keywords.filter((k) => k.type === "INCLUDE");
  const excludes = keywords.filter((k) => k.type === "EXCLUDE");

  // Conditions envoyées à la base de données
  const and: Prisma.ArticleWhereInput[] = [];
  if (q) and.push(textMatch(q));
  if (useFilters && includes.length > 0) {
    and.push({ OR: includes.map((k) => textMatch(k.word)) });
  }
  if (view === "unread") {
    and.push({ states: { none: { userId: user.id, isRead: true } } });
  }
  if (view === "starred") {
    and.push({ states: { some: { userId: user.id, isStarred: true } } });
  }

  const fetched = await prisma.article.findMany({
    where: {
      feed: {
        subscriptions: {
          // userId dans le même filtre : on ne voit que SES abonnements
          some: { userId: user.id, ...(folder ? { folderId: folder } : {}) },
        },
      },
      AND: and,
    },
    include: {
      feed: true,
      // uniquement l'état de CET utilisateur
      states: { where: { userId: user.id } },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
    take: 200,
  });

  // Les mots à exclure sont appliqués ici
  const kept =
    useFilters && excludes.length > 0
      ? fetched.filter((a) => {
          const text = `${a.title} ${a.summary ?? ""}`.toLowerCase();
          return !excludes.some((k) => text.includes(k.word));
        })
      : fetched;
  const shown = Math.min(200, Math.max(50, Math.round((Number(rawLimit) || 50) / 50) * 50));
  const articles = kept.slice(0, shown);
  const hasMore = kept.length > shown;
  const hasRules = keywords.length > 0;

  const tabs = [
    { key: "all", label: "Tout", param: undefined },
    { key: "unread", label: "Non lus", param: "unread" },
    { key: "starred", label: "Favoris ★", param: "starred" },
  ] as const;

  return (
    <>
      {/* Recherche */}
      <form action="/dashboard/articles" method="get" className="mb-4 flex gap-2">
        {folder && <input type="hidden" name="folder" value={folder} />}
        {!useFilters && <input type="hidden" name="all" value="1" />}
        {viewParam && <input type="hidden" name="view" value={viewParam} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher dans les articles..."
          className="flex-1 rounded border p-2"
        />
        <button className="rounded border px-3">Chercher</button>
        {q && (
          <Link
            href={href({ folder, all, view: viewParam })}
            className="flex items-center px-2 text-sm underline"
          >
            Effacer
          </Link>
        )}
      </form>

      {/* Vues : tout / non lus / favoris */}
      <nav className="mb-3 flex gap-3 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ folder, q, all, view: t.param })}
            className={view === t.key ? "font-bold underline" : ""}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Dossiers */}
      <nav className="mb-4 flex flex-wrap gap-3 text-sm text-gray-500">
        <Link
          href={href({ q, all, view: viewParam })}
          className={!folder ? "font-bold underline" : ""}
        >
          Tous les dossiers
        </Link>
        {folders.map((f) => (
          <Link
            key={f.id}
            href={href({ folder: f.id, q, all, view: viewParam })}
            className={folder === f.id ? "font-bold underline" : ""}
          >
            {f.name}
          </Link>
        ))}
      </nav>

      {/* Mes filtres */}
      <details className="mb-6 rounded border p-3" open={hasRules ? undefined : true}>
        <summary className="cursor-pointer font-semibold">
          Mes filtres{" "}
          <span className="text-sm font-normal text-gray-500">
            ({includes.length} à garder, {excludes.length} à exclure)
          </span>
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <form action={addKeyword} className="flex gap-2">
            <input
              name="word"
              placeholder="Un mot ou une expression"
              className="flex-1 rounded border p-2"
              required
            />
            <select name="type" className="rounded border p-2">
              <option value="INCLUDE">Garder</option>
              <option value="EXCLUDE">Exclure</option>
            </select>
            <button className="rounded bg-blue-600 px-3 text-white">Ajouter</button>
          </form>

          {[
            { title: "À garder", list: includes },
            { title: "À exclure", list: excludes },
          ].map(({ title, list }) => (
            <div key={title}>
              <p className="mb-1 text-sm text-gray-500">{title}</p>
              {list.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {list.map((k) => (
                    <li key={k.id}>
                      <form action={deleteKeyword}>
                        <input type="hidden" name="id" value={k.id} />
                        <button
                          title="Supprimer"
                          className="rounded-full border px-3 py-1 text-sm"
                        >
                          {k.word} ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {hasRules && (
            <Link
              href={href({
                folder,
                q,
                view: viewParam,
                all: useFilters ? "1" : undefined,
              })}
              className="text-sm underline"
            >
              {useFilters ? "Voir tout (ignorer mes filtres)" : "Réactiver mes filtres"}
            </Link>
          )}
        </div>
      </details>

      {/* Résultats */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {articles.length} article{articles.length > 1 ? "s" : ""}
          {hasRules && !useFilters ? " (filtres ignorés)" : ""}
        </p>

        {articles.length > 0 && view !== "starred" && (
          <form action={markAllRead}>
            {articles.map((a) => (
              <input key={a.id} type="hidden" name="ids" value={a.id} />
            ))}
            <button className="rounded border px-2 py-1 text-sm">
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      {articles.length === 0 ? (
        <p className="text-gray-500">
          {view === "unread"
            ? "Tout est lu, bravo !"
            : view === "starred"
              ? "Aucun favori pour l'instant."
              : "Aucun article ne correspond. Essaie « Voir tout », ou clique sur « Actualiser »."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {articles.map((a) => {
            const state = a.states[0];
            const isRead = state?.isRead ?? false;
            const isStarred = state?.isStarred ?? false;

            return (
              <li key={a.id} className={isRead ? "opacity-60" : ""}>
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline ${isRead ? "" : "font-semibold"}`}
                >
                  {isStarred && "★ "}
                  {a.title}
                </a>
                <p className="text-xs text-gray-500">
                  {a.feed.title}
                  {a.publishedAt
                    ? ` · ${a.publishedAt.toLocaleDateString("fr-FR")}`
                    : ""}
                </p>
                {a.summary && <p className="text-sm">{a.summary}</p>}

                <div className="mt-1 flex gap-2 text-xs">
                  <form action={setRead}>
                    <input type="hidden" name="articleId" value={a.id} />
                    <input type="hidden" name="value" value={isRead ? "0" : "1"} />
                    <button className="rounded border px-2 py-0.5">
                      {isRead ? "Marquer non lu" : "Marquer lu"}
                    </button>
                  </form>
                  <form action={setStarred}>
                    <input type="hidden" name="articleId" value={a.id} />
                    <input type="hidden" name="value" value={isStarred ? "0" : "1"} />
                    <button className="rounded border px-2 py-0.5">
                      {isStarred ? "★ Retirer des favoris" : "☆ Favori"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <Link
          href={href({
            folder,
            q,
            all,
            view: viewParam,
            limit: String(shown + 50),
          })}
          className="mt-4 inline-block rounded border px-3 py-2 text-sm"
        >
          Voir plus d'articles
        </Link>
      )}
    </>
  );
}

export default function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <main className="mx-auto my-10 max-w-2xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm underline">
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold">Mes articles</h1>
        </div>
        <form action={refreshMyFeeds}>
          <button className="rounded bg-blue-600 px-3 py-2 text-white">
            Actualiser
          </button>
        </form>
      </div>

      <Suspense fallback={<p>Chargement...</p>}>
        <Articles searchParams={searchParams} />
      </Suspense>
    </main>
  );
}