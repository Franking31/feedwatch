"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronIcon } from "@/lib/icons";
import type { TreeData } from "@/lib/unread-counts";

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="text-xs tabular-nums text-muted">{n > 99 ? "99+" : n}</span>;
}

export default function FolderTree({ data }: { data: TreeData }) {
  const params = useSearchParams();
  const activeFolder = params.get("folder");
  const activeFeed = params.get("feed");

  // Garde l'onglet (Non lus, Favoris...) quand on change de dossier
  const to = (next: { folder?: string; feed?: string }) => {
    const sp = new URLSearchParams();
    for (const key of ["view", "all"]) {
      const value = params.get(key);
      if (value) sp.set(key, value);
    }
    if (next.folder) sp.set("folder", next.folder);
    if (next.feed) sp.set("feed", next.feed);
    const query = sp.toString();
    return `/dashboard/articles${query ? `?${query}` : ""}`;
  };

  const row = (active: boolean) =>
    `flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
      active ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-paper"
    }`;

  const allActive = !activeFolder && !activeFeed;
  const empty = data.folders.length === 0 && data.unfiled.length === 0;

  return (
    <nav aria-label="Flux et dossiers" className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="font-semibold">Flux</p>
        <Link
          href="/dashboard"
          className="text-xs text-muted underline underline-offset-4 hover:text-ink"
        >
          Gérer
        </Link>
      </div>

      <Link
        href={to({})}
        aria-current={allActive ? "page" : undefined}
        className={row(allActive)}
      >
        <span>Tous les articles</span>
        <Count n={data.total} />
      </Link>

      {data.folders.map((folder) => (
        <details key={folder.id} open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
            <span className="text-muted transition-transform group-open:rotate-90">
              <ChevronIcon size={16} />
            </span>
            <Link
              href={to({ folder: folder.id })}
              className={row(activeFolder === folder.id && !activeFeed)}
            >
              <span className="truncate">{folder.name}</span>
              <Count n={folder.unread} />
            </Link>
          </summary>

          <ul className="ml-5 border-l border-line pl-2">
            {folder.feeds.map((f) => (
              <li key={f.id}>
                <Link href={to({ feed: f.id })} className={row(activeFeed === f.id)}>
                  <span className="truncate">{f.title}</span>
                  <Count n={f.unread} />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {data.unfiled.length > 0 && (
        <div className="mt-2">
          <p className="px-2 py-1 text-xs text-muted">Sans dossier</p>
          <ul>
            {data.unfiled.map((f) => (
              <li key={f.id}>
                <Link href={to({ feed: f.id })} className={row(activeFeed === f.id)}>
                  <span className="truncate">{f.title}</span>
                  <Count n={f.unread} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && (
        <p className="px-2 text-sm text-muted">
          Aucun flux pour l'instant. Ajoute-en avec « Gérer ».
        </p>
      )}
    </nav>
  );
}