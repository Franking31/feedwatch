"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { generateDigest, isDigestStyle } from "@/lib/digest";
import { redirect } from "next/navigation";

type GenState = { error?: string } | null;

export async function saveDigestSettings(formData: FormData) {
  const user = await requireUser();

  const enabled = formData.get("enabled") === "on";
  const useFilters = formData.get("useFilters") === "on";

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
  };

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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.digest.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (count >= 3) {
    return { error: "Maximum 3 digests par 24 h. Réessaie plus tard." };
  }

  const result = await generateDigest(user.id, { manual: true });
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/digest");
  return null;
}

export async function deleteDigest(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.digest.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard/digest");
}