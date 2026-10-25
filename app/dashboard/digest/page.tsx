import { Fragment, Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DIGEST_STYLES } from "@/lib/digest";
import { saveDigestSettings, deleteDigest } from "./actions";
import GenerateButton from "./generate-button";
import SubmitButton from "../submit-button";
import ConfirmButton from "../confirm-button";
import EmailButton from "./email-button";
import { mailConfigured } from "@/lib/mailer";

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

export const metadata = { title: "Digest" };

// Le texte du digest : chaque référence [3] devient un lien vers l'article cité
function DigestText({ content, sources }: { content: string; sources: Source[] }) {
  const parts = content.split(/\[(\d{1,3})\]/g);

  return (
    <p className="whitespace-pre-wrap text-[1.0625rem] leading-relaxed">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;

        const source = sources.find((s) => s.n === Number(part));
        if (!source) return <Fragment key={i}>[{part}]</Fragment>;

        return (
          <a
            key={i}
            href={source.link}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
            className="text-sm font-medium text-accent hover:underline"
          >
            [{part}]
          </a>
        );
      })}
    </p>
  );
}

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
  };
}) {
  const sources = digest.sources as Source[];

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Du {fmt(digest.periodStart)} au {fmt(digest.periodEnd)}, {digest.articleCount}{" "}
        article{digest.articleCount > 1 ? "s" : ""}
      </p>

      <div className="max-w-prose">
        <DigestText content={digest.content} sources={sources} />
      </div>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-medium">
          Sources ({sources.length})
        </summary>
        <ol className="mt-3 flex flex-col gap-1.5">
          {sources.map((s) => (
            <li key={s.n}>
              <span className="text-muted">[{s.n}]</span>{" "}
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {s.title}
              </a>{" "}
              <span className="text-muted">{s.feed}</span>
            </li>
          ))}
        </ol>
      </details>

     <div className="mt-6 flex flex-wrap items-center gap-4">
        <EmailButton digestId={digest.id} />
        <form action={deleteDigest}>
          <input type="hidden" name="id" value={digest.id} />
          <ConfirmButton
            message="Supprimer ce digest ?"
            className="btn btn-quiet btn-danger text-xs"
          >
            Supprimer ce digest
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}

async function DigestPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { saved } = await searchParams;

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
      {latest ? (
        <section aria-labelledby="latest-title">
          <h2 id="latest-title" className="mb-4 text-lg font-semibold">
            Dernier digest, {fmt(latest.createdAt)}
          </h2>
          <DigestView digest={latest} />
        </section>
      ) : (
        <p className="text-muted">
          Pas encore de digest. Clique sur « Générer maintenant » pour voir à quoi
          il ressemble.
        </p>
      )}

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="settings-title">
        <h2 id="settings-title" className="mb-4 text-lg font-semibold">
          Réglages
        </h2>

        <form action={saveDigestSettings} className="flex max-w-xl flex-col gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings?.enabled ?? false}
                className="h-4 w-4 accent-accent"
              />
              Générer mon digest automatiquement
            </label>
            <p className="ml-6 mt-1 text-sm text-muted">
              Il est prêt chaque matin vers 7 h, les jours cochés ci-dessous.
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Jours (3 maximum, dimanche par défaut)
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="days"
                    value={d.value}
                    defaultChecked={days.includes(d.value)}
                    className="h-4 w-4 accent-accent"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Format
            <select
              name="style"
              defaultValue={settings?.style ?? "themes"}
              className="field"
            >
              {Object.entries(DIGEST_STYLES).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Nombre d'articles maximum
            <input
              type="number"
              name="maxArticles"
              min={5}
              max={50}
              defaultValue={settings?.maxArticles ?? 30}
              className="field"
            />
            <span className="text-xs font-normal text-muted">Entre 5 et 50.</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="useFilters"
              defaultChecked={settings?.useFilters ?? true}
              className="h-4 w-4 accent-accent"
            />
            Utiliser mes filtres de mots-clés (garder et exclure)
          </label>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="emailEnabled"
                defaultChecked={settings?.emailEnabled ?? false}
                className="h-4 w-4 accent-accent"
              />
              Recevoir aussi mon digest par email
            </label>
            <p className="ml-6 mt-1 text-sm text-muted">
              {mailConfigured()
                ? `Envoyé à ${user.email}, en même temps que la génération automatique.`
                : "L'envoi d'emails n'est pas encore configuré sur ce serveur."}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Mes consignes pour l'IA (facultatif)
            <textarea
              name="instructions"
              rows={4}
              maxLength={1000}
              defaultValue={settings?.instructions ?? ""}
              placeholder="Par exemple : parle-moi comme à un étudiant en génie logiciel, mets en avant l'impact sur les développeurs, ton direct."
              className="field"
            />
            <span className="text-xs font-normal text-muted">1000 caractères maximum.</span>
          </label>

          <div className="flex items-center gap-4">
            <SubmitButton className="btn btn-primary" pendingLabel="Enregistrement...">
              Enregistrer les réglages
            </SubmitButton>
            {saved === "1" && (
              <p role="status" className="text-sm text-ok">
                Réglages enregistrés.
              </p>
            )}
          </div>
        </form>
      </section>

      {older.length > 0 && (
        <section className="mt-12 border-t border-line pt-8" aria-labelledby="older-title">
          <h2 id="older-title" className="mb-2 text-lg font-semibold">
            Anciens digests
          </h2>
          {older.map((d) => (
            <details key={d.id} className="border-t border-line py-3">
              <summary className="cursor-pointer font-medium">{fmt(d.createdAt)}</summary>
              <div className="mt-4">
                <DigestView digest={d} />
              </div>
            </details>
          ))}
        </section>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-3x1 px-4 py-8 md:px-10 md:py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digest</h1>
          <p className="mt-1 max-w-md text-sm text-muted">
            Une synthèse de tes nouveaux articles, rédigée par l'IA.
          </p>
        </div>
        <GenerateButton />
      </header>

      <Suspense fallback={<p className="text-muted">Chargement...</p>}>
        <DigestPage searchParams={searchParams} />
      </Suspense>
    </div>
  );
}