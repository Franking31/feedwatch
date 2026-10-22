"use server";

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parser, saveArticles, refreshMany } from "@/lib/feeds";
import { XMLParser } from "fast-xml-parser";
import { assertPublicUrl } from "@/lib/safe-url";
import { string } from "better-auth";
import { rateLimit } from "@/lib/rate-limit";


type AddState = { error?: string; success?: string } | null;

export type PreviewResult =
  | { error: string }
  | {
      title: string;
      items: { title: string; link: string; date: string | null }[];
    };

// ---------- DOSSIERS ----------

export async function createFolder(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // upsert = "crée si ça n'existe pas déjà" (évite les doublons)
  await prisma.folder.upsert({
    where: { userId_name: { userId: user.id, name } },
    update: {},
    create: { name, userId: user.id },
  });
  revalidatePath("/dashboard");
}

export async function renameFolder(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  try {
    await prisma.folder.updateMany({
      where: { id, userId: user.id }, // userId = vérification de propriété
      data: { name },
    });
  } catch {
    // un dossier avec ce nom existe déjà : on ne change rien
  }
  revalidatePath("/dashboard");
}

export async function deleteFolder(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Les abonnements du dossier ne sont pas supprimés : ils passent "sans dossier"
  await prisma.folder.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard");
}

// ---------- ABONNEMENTS ----------

export async function addSubscription(
  _prev: AddState,
  formData: FormData
): Promise<AddState> {
  const user = await requireUser();
  if (!rateLimit(`add:${user.id}`, 30, 10 * 60 * 1000)) {
    return {error: "Trop d'ajouts d'affilée. Réessaie dans quelques minutes."}
  }
  const url = String(formData.get("url") ?? "").trim();
  let folderId: string | null = String(formData.get("folderId") ?? "") || null;
  if (!url) return { error: "Colle l'adresse d'un flux RSS." };

  // Le dossier choisi doit appartenir à l'utilisateur
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    });
    if (!folder) folderId = null;
  }

  // On vérifie que c'est un vrai flux RSS
  let parsed;
  try {
    parsed = await parser.parseURL(url);
  } catch {
    return { error: "Ce lien n'est pas un flux RSS valide." };
  }

  // Le flux est partagé entre tous les comptes : on le crée une seule fois
  const feed = await prisma.feed.upsert({
    where: { url },
    update: {},
    create: { url, title: parsed.title ?? url, siteUrl: parsed.link ?? null },
  });

  const existing = await prisma.subscription.findUnique({
    where: { userId_feedId: { userId: user.id, feedId: feed.id } },
  });
  if (existing) return { error: "Tu es déjà abonné à ce flux." };

  const maxSubs = Number(process.env.Max_SUBSCRIPTION) || 200;
  const subCount = await prisma.subscription.count({ where: { userId: user.id }} );
  if (subCount >= maxSubs){
    return { error : `Limite de ${maxSubs} abonnements atteinte.` };
  }

  await prisma.subscription.create({
    data: { userId: user.id, feedId: feed.id, folderId },
  });

  // On enregistre tout de suite les articles déjà lus pendant la vérification
  try {
    await saveArticles(feed.id, parsed.items);
  } catch {
    // pas grave : le prochain rafraîchissement les récupérera
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/articles");
  return { success: `Abonné à « ${feed.title} »` };
}

export async function moveSubscription(formData: FormData) {
  const user = await requireUser();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  let folderId: string | null = String(formData.get("folderId") ?? "") || null;
  if (!subscriptionId) return;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id },
    });
    if (!folder) folderId = null;
  }

  await prisma.subscription.updateMany({
    where: { id: subscriptionId, userId: user.id },
    data: { folderId },
  });
  revalidatePath("/dashboard");
}

export async function removeSubscription(formData: FormData) {
  const user = await requireUser();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  await prisma.subscription.deleteMany({
    where: { id: subscriptionId, userId: user.id },
  });
  revalidatePath("/dashboard");
}

// ---------- APERÇU ET ACTUALISATION ----------

export async function previewFeed(url: string): Promise<PreviewResult> {
  const user = await requireUser(); // réservé aux comptes connectés
  if (!rateLimit(`preview:${user.id}`, 20, 10 * 60 * 1000)) {
    return { error: "Trop d'aperçus d'affilée. Réessaie dans quelques minutes." };
  }

  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    return { error: "L'adresse doit commencer par http:// ou https://" };
  }

  try {
    const feed = await parser.parseURL(clean);
    const items = feed.items
      .filter((i) => i.title && /^https?:\/\//i.test(i.link ?? ""))
      .slice(0, 5)
      .map((i) => ({
        title: i.title as string,
        link: i.link as string,
        date: i.isoDate ?? null,
      }));
    return { title: feed.title ?? clean, items };
  } catch {
    return { error: "Impossible de lire ce flux. Vérifie l'adresse." };
  }
}

// Actualise uniquement les flux auxquels l'utilisateur est abonné
export async function refreshMyFeeds() {
  const user = await requireUser();
  if (!rateLimit(`refresh:${user.id}`, 10, 60 * 60 * 1000)) return;
  const feeds = await prisma.feed.findMany({
    where: { subscriptions: { some: { userId: user.id } } },
    select: { id: true, url: true },
  });
  await refreshMany(feeds);
  revalidatePath("/dashboard/articles");
}

// ---------- MOTS-CLÉS ----------

export async function addKeyword(formData: FormData) {
    const user = await requireUser();
    const word = String(formData.get("word") ?? "")
        .trim()
        .toLowerCase()
        .slice(0, 50);
    const type = formData.get("type") === "EXCLUDE" ? "EXCLUDE" : "INCLUDE";
    if (!word) return;

    await prisma.keyword.upsert({
        where: { userId_word_type: { userId: user.id, word, type } },
        update: {},
        create: { userId: user.id, word, type },
  });
  revalidatePath("/dashboard/articles");
}

export async function deleteKeyword(formData: FormData) {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    // userId : on ne peut supprimer que SES mots-clés
    await prisma.keyword.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/dashboard/articles");
}

// ---------- LU / FAVORIS ----------

// Garde uniquement les articles que l'utilisateur a le droit de voir
// (ceux de ses abonnements). Évite d'écrire sur n'importe quel identifiant.
async function visibleArticleIds(userId: string, ids: string[]) {
  const rows = await prisma.article.findMany({
    where: {
      id: { in: ids },
      feed: { subscriptions: { some: { userId } } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function setRead(formData: FormData) {
  const user = await requireUser();
  const articleId = String(formData.get("articleId") ?? "");
  const isRead = formData.get("value") === "1";

  const [id] = await visibleArticleIds(user.id, [articleId]);
  if (!id) return;

  await prisma.articleState.upsert({
    where: { userId_articleId: { userId: user.id, articleId: id } },
    update: { isRead },
    create: { userId: user.id, articleId: id, isRead },
  });
  revalidatePath("/dashboard/articles");
}

export async function setStarred(formData: FormData) {
  const user = await requireUser();
  const articleId = String(formData.get("articleId") ?? "");
  const isStarred = formData.get("value") === "1";

  const [id] = await visibleArticleIds(user.id, [articleId]);
  if (!id) return;

  await prisma.articleState.upsert({
    where: { userId_articleId: { userId: user.id, articleId: id } },
    update: { isStarred },
    create: { userId: user.id, articleId: id, isStarred },
  });
  revalidatePath("/dashboard/articles");
}

export async function markAllRead(formData: FormData) {
  const user = await requireUser();
  const ids = formData.getAll("ids").map(String).slice(0, 200);
  if (ids.length === 0) return;

  const valid = await visibleArticleIds(user.id, ids);
  if (valid.length === 0) return;

  await prisma.$transaction([
    // crée l'état pour les articles qui n'en ont pas encore
    prisma.articleState.createMany({
      data: valid.map((articleId) => ({ userId: user.id, articleId, isRead: true })),
      skipDuplicates: true,
    }),
    // et met à jour ceux qui en avaient déjà un
    prisma.articleState.updateMany({
      where: { userId: user.id, articleId: { in: valid } },
      data: { isRead: true },
    }),
  ]);
  revalidatePath("/dashboard/articles");
}

// ---------- IMPORT OPML ----------

type ImportState = { error?: string; success?: string } | null;
type OpmlFeed = { url: string; title: string; folder: string | null };

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "outline", // un seul <outline> = quand même une liste
});

// Parcourt les <outline> : avec xmlUrl = un flux, sinon = un dossier
function collectFeeds(nodes: unknown, folder: string | null, out: OpmlFeed[]) {
  if (!Array.isArray(nodes)) return;

  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as Record<string, unknown>;

    const xmlUrl =
      typeof node["@_xmlUrl"] === "string" ? node["@_xmlUrl"].trim() : "";
    const name = String(node["@_title"] ?? node["@_text"] ?? "").trim();

    if (xmlUrl) {
      out.push({ url: xmlUrl, title: name || xmlUrl, folder });
    } else {
      collectFeeds(node.outline, name ? name.slice(0, 100) : folder, out);
    }
  }
}

export async function importOpml(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisis un fichier OPML." };
  }
  if (file.size > 1024 * 1024) {
    return { error: "Fichier trop gros (1 Mo maximum)." };
  }

  const found: OpmlFeed[] = [];
  try {
    const doc = xmlParser.parse(await file.text());
    collectFeeds(doc?.opml?.body?.outline, null, found);
  } catch {
    return { error: "Ce fichier n'est pas un OPML valide." };
  }
  if (found.length === 0) return { error: "Aucun flux trouvé dans ce fichier." };

  // Doublons retirés, 150 flux maximum
  const unique = Array.from(new Map(found.map((f) => [f.url, f])).values()).slice(0, 150);

  // Filtre de sécurité : seules les adresses publiques passent (par lots de 10)
  const valid: OpmlFeed[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map((f) => assertPublicUrl(f.url)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") valid.push(batch[idx]);
    });
  }
  const skipped = unique.length - valid.length;

  // Les dossiers (50 maximum)
  const folderNames = Array.from(
    new Set(valid.map((f) => f.folder).filter((n): n is string => !!n))
  ).slice(0, 50);
  const folderIds = new Map<string, string>();
  for (const name of folderNames) {
    const folder = await prisma.folder.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { userId: user.id, name },
    });
    folderIds.set(name, folder.id);
  }

  const maxSubs = Number(process.env.MAX_SUBSCRIPTIONS) || 200;
  let room =
    maxSubs - (await prisma.subscription.count({ where: { userId: user.id } }));
  let limitReached = false;

  // Les abonnements
  let added = 0;
  let already = 0;
  for (const f of valid) {
    const feed = await prisma.feed.upsert({
      where: { url: f.url },
      update: {},
      create: { url: f.url, title: f.title.slice(0, 200) },
    });

    const existing = await prisma.subscription.findUnique({
      where: { userId_feedId: { userId: user.id, feedId: feed.id } },
    });
    if (existing) {
      already++;
      continue;
    }

    if (room <= 0) {
    limitReached = true;
    break;
    }

    await prisma.subscription.create({
      data: {
        userId: user.id,
        feedId: feed.id,
        folderId: f.folder ? (folderIds.get(f.folder) ?? null) : null,
      },
    });
    added++;
    room--;
  }

  revalidatePath("/dashboard");
  const more =
    found.length > 150
      ? " (150 flux maximum par import)"
      : limitReached
        ? ` (limite de ${maxSubs} abonnements atteinte)`
        : "";
  return {
    success: `${added} flux ajoutés, ${already} déjà présents, ${skipped} ignorés (adresse invalide ou non autorisée).${more} Va sur « Mes articles » et clique sur « Actualiser » pour récupérer leurs articles.`,
  };
}
