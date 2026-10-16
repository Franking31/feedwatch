"use server";

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parser, saveArticles, refreshMany } from "@/lib/feeds";


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
  await requireUser(); // réservé aux comptes connectés

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
