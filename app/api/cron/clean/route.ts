import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/text";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;

  // Par paquets de 500 articles, pour ne pas surcharger la base
  while (true) {
    const batch = await prisma.article.findMany({
      select: { id: true, title: true, summary: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;

    for (const a of batch) {
      scanned++;
      const title = (cleanText(a.title) || a.title).slice(0, 300);
      const summary = a.summary ? cleanText(a.summary).slice(0, 500) || null : null;

      if (title !== a.title || summary !== a.summary) {
        await prisma.article.update({
          where: { id: a.id },
          data: { title, summary },
        });
        changed++;
      }
    }
    cursor = batch[batch.length - 1].id;
  }

  return Response.json({ scanned, changed });
}