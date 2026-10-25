import { prisma } from "./prisma";

export type TreeData = {
  total: number;
  folders: {
    id: string;
    name: string;
    unread: number;
    feeds: { id: string; title: string; unread: number }[];
  }[];
  unfiled: { id: string; title: string; unread: number }[];
};

export async function getTree(userId: string): Promise<TreeData> {
  const [folders, subs, keywords, unread] = await Promise.all([
    prisma.folder.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.subscription.findMany({
      where: { userId },
      include: { feed: { select: { id: true, title: true } } },
    }),
    prisma.keyword.findMany({ where: { userId } }),
    prisma.article.findMany({
      where: {
        feed: { subscriptions: { some: { userId } } },
        states: { none: { userId, isRead: true } },
      },
      select: { feedId: true, title: true, summary: true },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      take: 1000,
    }),
  ]);

  const includes = keywords.filter((k) => k.type === "INCLUDE").map((k) => k.word);
  const excludes = keywords.filter((k) => k.type === "EXCLUDE").map((k) => k.word);

  // Combien d'articles non lus par flux, en appliquant tes filtres
  const counts = new Map<string, number>();
  for (const a of unread) {
    const text = `${a.title} ${a.summary ?? ""}`.toLowerCase();
    if (includes.length > 0 && !includes.some((w) => text.includes(w))) continue;
    if (excludes.some((w) => text.includes(w))) continue;
    counts.set(a.feedId, (counts.get(a.feedId) ?? 0) + 1);
  }

  const toFeed = (s: (typeof subs)[number]) => ({
    id: s.feed.id,
    title: s.feed.title,
    unread: counts.get(s.feed.id) ?? 0,
  });
  const byTitle = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title, "fr");

  return {
    total: Array.from(counts.values()).reduce((n, c) => n + c, 0),
    folders: folders.map((f) => {
      const feeds = subs.filter((s) => s.folderId === f.id).map(toFeed).sort(byTitle);
      return {
        id: f.id,
        name: f.name,
        feeds,
        unread: feeds.reduce((n, x) => n + x.unread, 0),
      };
    }),
    unfiled: subs.filter((s) => !s.folderId).map(toFeed).sort(byTitle),
  };
}