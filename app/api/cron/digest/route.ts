import { prisma } from "@/lib/prisma";
import { generateDigest } from "@/lib/digest";

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  // Quel jour sommes-nous en France ?
  const dayName = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Europe/Paris",
  });
  const today = WEEKDAYS[dayName];

  const due = await prisma.digestSettings.findMany({
    where: { enabled: true, days: { has: today } },
    select: { userId: true },
  });

  // Sécurité : jamais deux digests en moins de 20 h pour le même compte
  const recently = new Date(Date.now() - 20 * 60 * 60 * 1000);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const { userId } of due) {
    const already = await prisma.digest.findFirst({
      where: { userId, createdAt: { gte: recently } },
    });
    if (already) {
      skipped++;
      continue;
    }

    const result = await generateDigest(userId, { manual: false });
    if (result.ok) generated++;
    else if (result.empty) skipped++;
    else failed++;
  }

  return Response.json({ due: due.length, generated, skipped, failed });
}