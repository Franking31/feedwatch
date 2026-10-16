import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import SignOutButton from "./sign-out-button";
import AddFeedForm from "./add-feed-form";
import Link from "next/link";
import {
  createFolder,
  renameFolder,
  deleteFolder,
  moveSubscription,
  removeSubscription,
} from "./actions";

type FolderOption = { id: string; name: string };
type Sub = {
  id: string;
  folderId: string | null;
  feed: { title: string; url: string };
};

// Une ligne = un abonnement
function SubscriptionRow({ sub, folders }: { sub: Sub; folders: FolderOption[] }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{sub.feed.title}</p>
        <p className="truncate text-xs text-gray-500">{sub.feed.url}</p>
      </div>

      <form action={moveSubscription} className="flex gap-1">
        <input type="hidden" name="subscriptionId" value={sub.id} />
        <select
          name="folderId"
          defaultValue={sub.folderId ?? ""}
          className="rounded border p-1 text-sm"
        >
          <option value="">Sans dossier</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button className="rounded border px-2 text-sm">Déplacer</button>
      </form>

      <form action={removeSubscription}>
        <input type="hidden" name="subscriptionId" value={sub.id} />
        <button className="rounded border px-2 text-sm text-red-500">
          Se désabonner
        </button>
      </form>
    </li>
  );
}

// Tout ce qui dépend de l'utilisateur connecté
async function Dashboard() {
  const user = await requireUser();

  const [folders, unfiled] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id },
      include: { subscriptions: { include: { feed: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.subscription.findMany({
      where: { userId: user.id, folderId: null },
      include: { feed: true },
    }),
  ]);

  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <Link
            href="/dashboard/articles"
            className="mb-8 inline-block rounded bg-blue-600 px-3 py-2 text-white"
          >
            Voir mes articles →
          </Link>
          <Link
              href="/dashboard/digest"
              className="mb-8 ml-2 inline-block rounded border px-3 py-2"
            >
              Mon digest hebdo →
          </Link>
        <div>
          <h1 className="text-2xl font-bold">Bienvenue {user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Ajouter un flux</h2>
        <AddFeedForm folders={folderOptions} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Nouveau dossier</h2>
        <form action={createFolder} className="flex gap-2">
          <input
            name="name"
            placeholder="Ex : IA, Jeux vidéo..."
            className="flex-1 rounded border p-2"
            required
          />
          <button className="rounded bg-blue-600 px-3 text-white">Créer</button>
        </form>
      </section>

      {folders.map((folder) => (
        <section key={folder.id} className="mb-6 rounded border p-3">
          <div className="mb-2 flex gap-2">
            <form action={renameFolder} className="flex flex-1 gap-1">
              <input type="hidden" name="id" value={folder.id} />
              <input
                name="name"
                defaultValue={folder.name}
                className="flex-1 rounded border p-1 font-semibold"
                required
              />
              <button className="rounded border px-2 text-sm">Renommer</button>
            </form>
            <form action={deleteFolder}>
              <input type="hidden" name="id" value={folder.id} />
              <button className="rounded border px-2 text-sm text-red-500">
                Supprimer
              </button>
            </form>
          </div>

          {folder.subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500">Dossier vide.</p>
          ) : (
            <ul>
              {folder.subscriptions.map((sub) => (
                <SubscriptionRow key={sub.id} sub={sub} folders={folderOptions} />
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="rounded border p-3">
        <h2 className="mb-2 font-semibold">Sans dossier</h2>
        {unfiled.length === 0 ? (
          <p className="text-sm text-gray-500">Rien ici.</p>
        ) : (
          <ul>
            {unfiled.map((sub) => (
              <SubscriptionRow key={sub.id} sub={sub} folders={folderOptions} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto my-10 max-w-2xl p-4">
      <Suspense fallback={<p>Chargement...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}