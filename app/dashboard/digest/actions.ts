"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { generateDigestsForUser, isDigestStyle } from "@/lib/digest";
import { redirect } from "next/navigation";
import { refreshMany } from "@/lib/feeds";
import { emailDigests } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";

type GenState = { error?: string } | null;



export async function saveDigestSettings(formData: FormData) {
  const user = await requireUser();

  const enabled = formData.get("enabled") === "on";
  const useFilters = formData.get("useFilters") === "on";
  const emailEnabled = formData.get("emailEnabled") === "on";
  const splitByFolder = formData.get("splitByFolder") === "on";

  // 3 jours maximum, valeurs de 0 (dimanche) à 6 (samedi)
  const days = Array.from(
    new Set(
      formData
        .getAll("days")
        .map(Number)
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    )
  ).slice(0, 3);

  const maxArticles = Math.min(50, Math.max(5, Number(formData.get("maxArticles")) || 30));
  const rawStyle = String(formData.get("style") ?? "");
  const style = isDigestStyle(rawStyle) ? rawStyle : "themes";
  const instructions = String(formData.get("instructions") ?? "").trim().slice(0, 1000);

  const data = {
    enabled,
    days: days.length > 0 ? days : [0], // dimanche par défaut
    maxArticles,
    style,
    useFilters,
    instructions,
    emailEnabled,
  };

    // On récupère d'abord les derniers articles de tes flux
  const feeds = await prisma.feed.findMany({
    where: { subscriptions: { some: { userId: user.id } } },
    select: { id: true, url: true },
  });
  await refreshMany(feeds);

  await prisma.digestSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  revalidatePath("/dashboard/digest");
  redirect("/dashboard/digest?saved=1");
}

// "Générer maintenant" : limité à 3 par 24 h pour protéger ta facture
export async function generateDigestAction(
  _prev: GenState,
  _formData: FormData
): Promise<GenState> {
  const user = await requireUser();

  // 6 générations par heure au maximum, pour protéger ton quota d'IA
  if (!rateLimit(`gen:${user.id}`, 6, 60 * 60 * 1000)) {
    return { error: "Trop de générations récentes. Réessaie dans un moment." };
  }

  // On récupère d'abord les derniers articles de tes flux
  const feeds = await prisma.feed.findMany({
    where: { subscriptions: { some: { userId: user.id } } },
    select: { id: true, url: true },
  });
  await refreshMany(feeds);

  const run = await generateDigestsForUser(user.id, { manual: true });
  if (run.ids.length === 0) {
    return {
      error: run.firstError ?? "Aucun article nouveau sur la période (avec tes filtres).",
    };
  }

  revalidatePath("/dashboard/digest");
  return null;
}

type MailState = { error?: string; success?: string } | null;

export async function sendDigestEmailAction(
  _prev: MailState,
  formData: FormData
): Promise<MailState> {
  const user = await requireUser();
  const ids = formData.getAll("digestId").map(String).filter(Boolean).slice(0, 10);
  if (ids.length === 0) return { error: "Digest introuvable." };

  // 5 envois par heure au maximum
  if (!rateLimit(`mail:${user.id}`, 5, 60 * 60 * 1000)) {
    return { error: "Trop d'envois récents. Réessaie dans une heure." };
  }

  const result = await emailDigests(ids, user.id);
  if (!result.ok) return { error: result.error };
  return { success: `Envoyé à ${result.to}.` };
}

export async function deleteDigest(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.digest.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard/digest");
}