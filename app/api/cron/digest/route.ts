import { prisma } from "@/lib/prisma";
import { generateDigestsForUser } from "@/lib/digest";
import { emailDigests } from "@/lib/mailer";

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
    select: { userId: true, emailEnabled: true },
  });

  // Sécurité : jamais deux envois en moins de 20 h pour le même compte
  const recently = new Date(Date.now() - 20 * 60 * 60 * 1000);
  let digests = 0;
  let emails = 0;
  let skipped = 0;
  let failed = 0;

  for (const { userId, emailEnabled } of due) {
    const already = await prisma.digest.findFirst({
      where: { userId, createdAt: { gte: recently } },
    });
    if (already) {
      skipped++;
      continue;
    }

    const run = await generateDigestsForUser(userId, { manual: false });

    if (run.ids.length > 0) {
      digests += run.ids.length;
      if (emailEnabled) {
        const sent = await emailDigests(run.ids, userId);
        if (sent.ok) emails++;
      }
    } else if (run.failed > 0) {
      failed++;
    } else {
      skipped++;
    }
  }

  return Response.json({ due: due.length, digests, emails, skipped, failed });
}