import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import AddFeedForm from "./add-feed-form";
import ImportOpmlForm from "./import-opml-form";
import MoveSelect from "./move-select";
import ConfirmButton from "./confirm-button";
import SubmitButton from "./submit-button";
import {
  createFolder,
  renameFolder,
  deleteFolder,
  removeSubscription,
} from "./actions";

type FolderOption = { id: string; name: string };
type Sub = {
  id: string;
  folderId: string | null;
  feed: { title: string; url: string };
};

export const metadata = { title: "Flux et dossiers" };

// Une ligne = un abonnement
function SubscriptionRow({ sub, folders }: { sub: Sub; folders: FolderOption[] }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{sub.feed.title}</p>
        <p className="truncate text-xs text-muted">{sub.feed.url}</p>
      </div>

      <MoveSelect subscriptionId={sub.id} folderId={sub.folderId} folders={folders} />

      <form action={removeSubscription}>
        <input type="hidden" name="subscriptionId" value={sub.id} />
        <ConfirmButton
          message={`Te désabonner de « ${sub.feed.title} » ?`}
          className="btn btn-quiet btn-danger text-xs"
        >
          Se désabonner
        </ConfirmButton>
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
  const total =
    folders.reduce((n, f) => n + f.subscriptions.length, 0) + unfiled.length;

  return (
    <>
      <section aria-labelledby="add-title">
        <h2 id="add-title" className="mb-4 text-lg font-semibold">
          Ajouter un flux
        </h2>
        <AddFeedForm folders={folderOptions} />
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="subs-title">
        <h2 id="subs-title" className="text-lg font-semibold">
          Mes abonnements{" "}
          <span className="font-normal text-muted">{total}</span>
        </h2>

        {total === 0 && folders.length === 0 && (
          <p className="mt-3 text-muted">
            Aucun abonnement. Colle l'adresse d'un flux RSS ci-dessus, ou importe
            un fichier OPML plus bas.
          </p>
        )}

        {folders.map((folder) => (
          <div key={folder.id} className="mt-8">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <form action={renameFolder} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={folder.id} />
                <input
                  name="name"
                  defaultValue={folder.name}
                  aria-label="Nom du dossier"
                  required
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold hover:border-line focus:border-accent"
                />
                <SubmitButton className="btn btn-quiet text-xs" pendingLabel="Renommage...">
                  Renommer
                </SubmitButton>
              </form>

              <form action={deleteFolder}>
                <input type="hidden" name="id" value={folder.id} />
                <ConfirmButton
                  message={`Supprimer le dossier « ${folder.name} » ? Ses flux resteront dans « Sans dossier ».`}
                  className="btn btn-quiet btn-danger text-xs"
                >
                  Supprimer le dossier
                </ConfirmButton>
              </form>
            </div>

            {folder.subscriptions.length === 0 ? (
              <p className="border-t border-line py-3 text-sm text-muted">
                Dossier vide. Place-y un flux avec le sélecteur de dossier d'un abonnement.
              </p>
            ) : (
              <ul>
                {folder.subscriptions.map((sub) => (
                  <SubscriptionRow key={sub.id} sub={sub} folders={folderOptions} />
                ))}
              </ul>
            )}
          </div>
        ))}

        {unfiled.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-1 px-2 font-semibold">Sans dossier</h3>
            <ul>
              {unfiled.map((sub) => (
                <SubscriptionRow key={sub.id} sub={sub} folders={folderOptions} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="folder-title">
        <h2 id="folder-title" className="mb-4 text-lg font-semibold">
          Nouveau dossier
        </h2>
        <form action={createFolder} className="flex gap-2">
          <input
            name="name"
            placeholder="Par exemple : IA, Jeux vidéo"
            aria-label="Nom du nouveau dossier"
            className="field"
            required
          />
          <SubmitButton className="btn btn-primary" pendingLabel="Création...">
            Créer
          </SubmitButton>
        </form>
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="io-title">
        <h2 id="io-title" className="mb-4 text-lg font-semibold">
          Importer et exporter
        </h2>
        <ImportOpmlForm />
        <p className="mb-2 mt-8 text-sm text-muted">
          Pour garder une copie de tes abonnements ou les utiliser dans un autre lecteur :
        </p>
        <a href="/api/opml/export" className="btn">
          Exporter mes abonnements
        </a>
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Flux et dossiers</h1>
      <Suspense fallback={<p className="text-muted">Chargement...</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}