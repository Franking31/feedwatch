import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Highlight } from "@/lib/highlight";
import {
  refreshMyFeeds,
  addKeyword,
  deleteKeyword,
  setRead,
  setStarred,
  markAllRead,
} from "../actions";

type View = "all" | "unread" | "starred";
type Params = {
  folder?: string;
  q?: string;
  all?: string;
  view?: string;
  limit?: string;
};

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

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-line text-muted hover:text-ink"
  }`;

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
    </svg>
  );
}

async function Articles({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const {
    folder,
    q: rawQ,
    all,
    view: rawView,
    limit: rawLimit,
  } = await searchParams;

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

  const shown = Math.min(
    200,
    Math.max(50, Math.round((Number(rawLimit) || 50) / 50) * 50)
  );
  const articles = kept.slice(0, shown);
  const hasMore = kept.length > shown;
  const hasRules = keywords.length > 0;

  // Les mots à surligner : tes mots-clés à garder et ta recherche
  const highlightWords = [
    ...(useFilters ? includes.map((k) => k.word) : []),
    ...(q ? [q] : []),
  ];

  const tabs = [
    { key: "all", label: "Tout", param: undefined },
    { key: "unread", label: "Non lus", param: "unread" },
    { key: "starred", label: "Favoris", param: "starred" },
  ] as const;

  const emptyMessage =
    view === "unread"
      ? "Tout est lu."
      : view === "starred"
        ? "Aucun favori. Clique sur « Favori » sous un article pour le retrouver ici."
        : hasRules && useFilters
          ? "Aucun article ne correspond à tes filtres. Choisis « Ignorer mes filtres » pour voir ce qui est masqué."
          : "Aucun article pour l'instant. Ajoute un flux dans « Flux et dossiers », puis clique sur Actualiser.";

  return (
    <>
      {/* Recherche */}
      <form action="/dashboard/articles" method="get" className="mb-5 flex gap-2">
        {folder && <input type="hidden" name="folder" value={folder} />}
        {!useFilters && <input type="hidden" name="all" value="1" />}
        {viewParam && <input type="hidden" name="view" value={viewParam} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher dans les articles"
          aria-label="Rechercher dans les articles"
          className="field"
        />
        <button className="btn">Chercher</button>
        {q && (
          <Link
            href={href({ folder, all, view: viewParam })}
            className="btn btn-quiet"
          >
            Effacer
          </Link>
        )}
      </form>

      {/* Vues */}
      <nav aria-label="Vue" className="flex gap-6 border-b border-line text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ folder, q, all, view: t.param })}
            aria-current={view === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 font-medium ${
              view === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Dossiers */}
      {folders.length > 0 && (
        <nav aria-label="Dossiers" className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href={href({ q, all, view: viewParam })} className={chip(!folder)}>
            Tous les dossiers
          </Link>
          {folders.map((f) => (
            <Link
              key={f.id}
              href={href({ folder: f.id, q, all, view: viewParam })}
              className={chip(folder === f.id)}
            >
              {f.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Mes filtres */}
      <details
        className="mt-5 rounded-md border border-line bg-surface p-4"
        open={hasRules ? undefined : true}
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Mes filtres
          <span className="ml-2 font-normal text-muted">
            {includes.length} à garder, {excludes.length} à exclure
          </span>
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <form action={addKeyword} className="flex flex-wrap gap-2">
            <input
              name="word"
              placeholder="Un mot ou une expression"
              aria-label="Mot-clé"
              className="field min-w-0 flex-1"
              required
            />
            <select name="type" aria-label="Type de filtre" className="field w-auto">
              <option value="INCLUDE">Garder</option>
              <option value="EXCLUDE">Exclure</option>
            </select>
            <button className="btn btn-primary">Ajouter</button>
          </form>

          {[
            { title: "À garder", list: includes, kind: "include" },
            { title: "À exclure", list: excludes, kind: "exclude" },
          ].map(({ title, list, kind }) => (
            <div key={title}>
              <p className="mb-2 text-sm text-muted">{title}</p>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Aucun mot pour l'instant.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {list.map((k) => (
                    <li key={k.id}>
                      <form action={deleteKeyword}>
                        <input type="hidden" name="id" value={k.id} />
                        <button
                          aria-label={`Supprimer le mot ${k.word}`}
                          className={`rounded-full border px-3 py-1 text-sm ${
                            kind === "include"
                              ? "border-transparent bg-accent-soft text-accent"
                              : "border-dashed border-line text-muted line-through"
                          }`}
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
              className="self-start text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {useFilters ? "Ignorer mes filtres" : "Réactiver mes filtres"}
            </Link>
          )}
        </div>
      </details>

      {/* Résultats */}
      <div className="mb-1 mt-6 flex items-center justify-between">
        <p className="text-sm text-muted">
          {articles.length} article{articles.length > 1 ? "s" : ""}
          {hasRules && !useFilters ? ", filtres ignorés" : ""}
        </p>

        {articles.length > 0 && view !== "starred" && (
          <form action={markAllRead}>
            {articles.map((a) => (
              <input key={a.id} type="hidden" name="ids" value={a.id} />
            ))}
            <button className="btn btn-quiet text-xs">Tout marquer comme lu</button>
          </form>
        )}
      </div>

      {articles.length === 0 ? (
        <p className="border-t border-line py-8 text-muted">{emptyMessage}</p>
      ) : (
        <ul>
          {articles.map((a) => {
            const state = a.states[0];
            const isRead = state?.isRead ?? false;
            const isStarred = state?.isStarred ?? false;

            return (
              <li key={a.id} className="relative border-t border-line py-4 pl-4">
                {/* La barre cobalt signale un article non lu */}
                <span
                  aria-hidden="true"
                  className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-full ${
                    isRead ? "bg-transparent" : "bg-accent"
                  }`}
                />

                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {isStarred && (
                      <span className="text-accent">
                        <StarIcon filled />
                      </span>
                    )}
                    {a.feed.title}
                  </span>
                  {a.publishedAt && (
                    <time dateTime={a.publishedAt.toISOString()} className="text-muted">
                      {a.publishedAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Paris",
                      })}
                    </time>
                  )}
                </div>

                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-0.5 block text-[1.0625rem] leading-snug hover:underline ${
                    isRead ? "font-medium text-muted" : "font-semibold text-ink"
                  }`}
                >
                  <Highlight text={a.title} words={highlightWords} />
                  <span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
                </a>

                {a.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    <Highlight text={a.summary} words={highlightWords} />
                  </p>
                )}

                <div className="-ml-2 mt-2 flex gap-1">
                  <form action={setRead}>
                    <input type="hidden" name="articleId" value={a.id} />
                    <input type="hidden" name="value" value={isRead ? "0" : "1"} />
                    <button className="btn btn-quiet text-xs">
                      {isRead ? "Marquer non lu" : "Marquer lu"}
                    </button>
                  </form>
                  <form action={setStarred}>
                    <input type="hidden" name="articleId" value={a.id} />
                    <input type="hidden" name="value" value={isStarred ? "0" : "1"} />
                    <button className="btn btn-quiet text-xs">
                      <StarIcon filled={isStarred} />
                      {isStarred ? "Retirer des favoris" : "Favori"}
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
          className="btn mt-4"
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
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
        <form action={refreshMyFeeds}>
          <button className="btn btn-primary">Actualiser</button>
        </form>
      </header>

      <Suspense fallback={<p className="text-muted">Chargement des articles...</p>}>
        <Articles searchParams={searchParams} />
      </Suspense>
    </div>
  );
}