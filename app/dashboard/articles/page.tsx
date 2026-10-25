import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Highlight } from "@/lib/highlight";
import { BookmarkIcon, ReadIcon, RefreshIcon, SearchIcon } from "@/lib/icons";
import {
  refreshMyFeeds,
  addKeyword,
  deleteKeyword,
  setRead,
  setStarred,
  markAllRead,
} from "../actions";

export const metadata = { title: "Articles" };

type View = "all" | "unread" | "starred";
type Params = {
  folder?: string;
  feed?: string;
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

// "44 min", "4 h", "3 j", puis la date
function timeAgo(date: Date, now: number) {
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} j`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-line text-muted hover:text-ink"
  }`;

async function Articles({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const {
    folder,
    feed,
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

  const [folders, keywords, feedRow] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.keyword.findMany({
      where: { userId: user.id },
      orderBy: { word: "asc" },
    }),
    feed
      ? prisma.feed.findFirst({
          where: { id: feed, subscriptions: { some: { userId: user.id } } },
          select: { title: true },
        })
      : null,
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
      ...(feed ? { feedId: feed } : {}),
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
  const now = Date.now();

  const title =
    feedRow?.title ??
    folders.find((f) => f.id === folder)?.name ??
    "Tous les articles";

  // Les mots à surligner : tes mots-clés à garder et ta recherche
  const highlightWords = [
    ...(useFilters ? includes.map((k) => k.word) : []),
    ...(q ? [q] : []),
  ];

  const tabs = [
    { key: "unread", label: "Non lus", param: "unread" },
    { key: "all", label: "Tous", param: undefined },
    { key: "starred", label: "Favoris", param: "starred" },
  ] as const;

  const emptyMessage =
    view === "unread"
      ? "Tout est lu."
      : view === "starred"
        ? "Aucun favori. Clique sur l'icône marque-page d'un article pour le retrouver ici."
        : hasRules && useFilters
          ? "Aucun article ne correspond à tes filtres. Choisis « Ignorer mes filtres » pour voir ce qui est masqué."
          : "Aucun article pour l'instant. Ajoute un flux dans « Flux », puis clique sur Actualiser.";

  return (
    <>
      {/* Barre d'outils */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-surface px-4 py-3 md:px-6">
        <h1 className="mr-auto min-w-0 truncate text-lg font-bold">{title}</h1>

        <nav
          aria-label="Vue"
          className="inline-flex rounded-lg bg-paper p-1 text-sm"
        >
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href({ folder, feed, q, all, view: t.param })}
              aria-current={view === t.key ? "page" : undefined}
              className={`rounded-md px-3 py-1 font-medium ${
                view === t.key
                  ? "border border-line bg-surface text-ink"
                  : "border border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <form
          action="/dashboard/articles"
          method="get"
          role="search"
          className="relative w-full sm:w-56"
        >
          {folder && <input type="hidden" name="folder" value={folder} />}
          {feed && <input type="hidden" name="feed" value={feed} />}
          {!useFilters && <input type="hidden" name="all" value="1" />}
          {viewParam && <input type="hidden" name="view" value={viewParam} />}
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon size={16} />
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher"
            aria-label="Rechercher dans les articles"
            className="field pl-9"
          />
          <button className="sr-only">Chercher</button>
        </form>

        {articles.length > 0 && view !== "starred" && (
          <form action={markAllRead}>
            {articles.map((a) => (
              <input key={a.id} type="hidden" name="ids" value={a.id} />
            ))}
            <button className="btn">Tout marquer comme lu</button>
          </form>
        )}

        <form action={refreshMyFeeds}>
          <button className="btn btn-primary">
            <RefreshIcon size={16} />
            Actualiser
          </button>
        </form>
      </div>

      <div className="px-4 py-5 md:px-6">
        {/* Dossiers (sur téléphone, le panneau de gauche est masqué) */}
        {folders.length > 0 && (
          <nav aria-label="Dossiers" className="mb-4 flex flex-wrap gap-2 text-sm md:hidden">
            <Link
              href={href({ q, all, view: viewParam })}
              className={chip(!folder && !feed)}
            >
              Tous
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
          className="mb-5 rounded-[10px] border border-line bg-surface p-4"
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
            ].map(({ title: groupTitle, list, kind }) => (
              <div key={groupTitle}>
                <p className="mb-2 text-sm text-muted">{groupTitle}</p>
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
                  feed,
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

        <p className="mb-3 text-sm text-muted">
          {articles.length} article{articles.length > 1 ? "s" : ""}
          {hasRules && !useFilters ? ", filtres ignorés" : ""}
          {q && (
            <>
              . Recherche « {q} ».{" "}
              <Link
                href={href({ folder, feed, all, view: viewParam })}
                className="underline underline-offset-4 hover:text-ink"
              >
                Effacer la recherche
              </Link>
            </>
          )}
        </p>

        {articles.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line p-8 text-center text-muted">
            {emptyMessage}
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
            {articles.map((a) => {
              const state = a.states[0];
              const isRead = state?.isRead ?? false;
              const isStarred = state?.isStarred ?? false;

              return (
                <li key={a.id}>
                  <article className="flex h-full flex-col rounded-[10px] border border-line bg-surface p-4 hover:border-muted">
                    <h2 className="text-[0.95rem] font-semibold leading-snug">
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline ${isRead ? "text-muted" : "text-ink"}`}
                      >
                        <Highlight text={a.title} words={highlightWords} />
                        <span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
                      </a>
                    </h2>

                    <p className="mt-1 line-clamp-1 text-xs text-muted">{a.feed.title}</p>

                    {a.summary && (
                      <p className="mt-2 line-clamp-4 text-sm text-muted">
                        <Highlight text={a.summary} words={highlightWords} />
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <span className="text-xs text-muted">
                        {a.publishedAt ? (
                          <time dateTime={a.publishedAt.toISOString()}>
                            {timeAgo(a.publishedAt, now)}
                          </time>
                        ) : null}
                      </span>

                      <div className="-mr-1 flex gap-0.5">
                        <form action={setStarred}>
                          <input type="hidden" name="articleId" value={a.id} />
                          <input type="hidden" name="value" value={isStarred ? "0" : "1"} />
                          <button
                            className="icon-btn"
                            aria-pressed={isStarred}
                            aria-label={isStarred ? "Retirer des favoris" : "Ajouter aux favoris"}
                            title={isStarred ? "Retirer des favoris" : "Ajouter aux favoris"}
                          >
                            <BookmarkIcon filled={isStarred} />
                          </button>
                        </form>
                        <form action={setRead}>
                          <input type="hidden" name="articleId" value={a.id} />
                          <input type="hidden" name="value" value={isRead ? "0" : "1"} />
                          <button
                            className="icon-btn"
                            aria-pressed={isRead}
                            aria-label={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                            title={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                          >
                            <ReadIcon filled={isRead} />
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <Link
            href={href({
              folder,
              feed,
              q,
              all,
              view: viewParam,
              limit: String(shown + 50),
            })}
            className="btn mt-5"
          >
            Voir plus d'articles
          </Link>
        )}
      </div>
    </>
  );
}

export default function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Chargement des articles...</p>}>
      <Articles searchParams={searchParams} />
    </Suspense>
  );
}