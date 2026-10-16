import { prisma } from "@/lib/prisma";
import { refreshMany } from "@/lib/feeds";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  // Tous les flux qui ont au moins un abonné
  const feeds = await prisma.feed.findMany({
    where: { subscriptions: { some: {} } },
    select: { id: true, url: true },
  });

  const result = await refreshMany(feeds);
  return Response.json({ feeds: feeds.length, ...result });
}