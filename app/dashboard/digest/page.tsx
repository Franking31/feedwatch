import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DIGEST_STYLES } from "@/lib/digest";
import { saveDigestSettings, deleteDigest } from "./actions";
import GenerateButton from "./generate-button";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

type Source = { n: number; title: string; link: string; feed: string };

const fmt = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

function DigestView({
  digest,
}: {
  digest: {
    id: string;
    content: string;
    sources: unknown;
    articleCount: number;
    periodStart: Date;
    periodEnd: Date;
    createdAt: Date;
  };
}) {
  const sources = digest.sources as Source[];

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">
        Du {fmt(digest.periodStart)} au {fmt(digest.periodEnd)} · {digest.articleCount}{" "}
        articles
      </p>

      <p className="whitespace-pre-wrap">{digest.content}</p>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-500">Sources</summary>
        <ol className="mt-2 flex flex-col gap-1">
          {sources.map((s) => (
            <li key={s.n}>
              [{s.n}]{" "}
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {s.title}
              </a>{" "}
              <span className="text-gray-500">— {s.feed}</span>
            </li>
          ))}
        </ol>
      </details>

      <form action={deleteDigest} className="mt-3">
        <input type="hidden" name="id" value={digest.id} />
        <button className="rounded border px-2 py-0.5 text-xs text-red-500">
          Supprimer ce digest
        </button>
      </form>
    </div>
  );
}

async function DigestPage() {
  const user = await requireUser();

  const [settings, digests] = await Promise.all([
    prisma.digestSettings.findUnique({ where: { userId: user.id } }),
    prisma.digest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const days = settings?.days ?? [0];
  const [latest, ...older] = digests;

  return (
    <>
      <section className="mb-8">
        <GenerateButton />
        {!latest && (
          <p className="mt-3 text-sm text-gray-500">
            Pas encore de digest. Clique sur « Générer maintenant » pour tester.
          </p>
        )}
      </section>

      {latest && (
        <section className="mb-8 rounded border p-4">
          <h2 className="mb-2 text-lg font-semibold">
            Dernier digest · {fmt(latest.createdAt)}
          </h2>
          <DigestView digest={latest} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Mes réglages</h2>
        <form action={saveDigestSettings} className="flex flex-col gap-4 rounded border p-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={settings?.enabled ?? false} />
            Générer mon digest automatiquement
          </label>

          <fieldset>
            <legend className="mb-1 text-sm text-gray-500">
              Jours (3 maximum, dimanche par défaut)
            </legend>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    name="days"
                    value={d.value}
                    defaultChecked={days.includes(d.value)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            Format
            <select
              name="style"
              defaultValue={settings?.style ?? "themes"}
              className="rounded border p-2"
            >
              {Object.entries(DIGEST_STYLES).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Nombre d'articles maximum (5 à 50)
            <input
              type="number"
              name="maxArticles"
              min={5}
              max={50}
              defaultValue={settings?.maxArticles ?? 30}
              className="rounded border p-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="useFilters"
              defaultChecked={settings?.useFilters ?? true}
            />
            Utiliser mes filtres de mots-clés (garder / exclure)
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Mes consignes pour l'IA (facultatif, 1000 caractères max)
            <textarea
              name="instructions"
              rows={4}
              maxLength={1000}
              defaultValue={settings?.instructions ?? ""}
              placeholder="Ex : Parle-moi comme à un étudiant en génie logiciel. Mets en avant l'impact sur les développeurs. Ton direct, pas de blabla."
              className="rounded border p-2"
            />
          </label>

          <button className="self-start rounded bg-blue-600 px-3 py-2 text-white">
            Enregistrer
          </button>
        </form>
      </section>

      {older.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Anciens digests</h2>
          <div className="flex flex-col gap-2">
            {older.map((d) => (
              <details key={d.id} className="rounded border p-3">
                <summary className="cursor-pointer">{fmt(d.createdAt)}</summary>
                <div className="mt-3">
                  <DigestView digest={d} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function Page() {
  return (
    <main className="mx-auto my-10 max-w-2xl p-4">
      <Link href="/dashboard" className="text-sm underline">
        ← Retour
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Mon digest</h1>
      <Suspense fallback={<p>Chargement...</p>}>
        <DigestPage />
      </Suspense>
    </main>
  );
}