import Parser from "rss-parser";
import { prisma } from "./prisma";
import { fetchFeedText } from "./safe-url";

export const parser = new Parser({ timeout: 10000 });

function isHttpUrl(value?: string) {
  return !!value && /^https?:\/\//i.test(value);
}

// Enregistre les articles d'un flux (les doublons sont ignorés)
export async function saveArticles(feedId: string, items: Parser.Item[]) {
  const rows = items
    .slice(0, 50)
    .map((item) => {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !isHttpUrl(link) || !title) return null;

      const date = item.isoDate ? new Date(item.isoDate) : null;
      return {
        feedId,
        guid: item.guid ?? link,
        title: title.slice(0, 300),
        link,
        summary: item.contentSnippet?.slice(0, 500) ?? null,
        publishedAt: date && !isNaN(date.getTime()) ? date : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length > 0) {
    // skipDuplicates : un article déjà enregistré n'est pas recréé
    await prisma.article.createMany({ data: rows, skipDuplicates: true });
  }

  await prisma.feed.update({
    where: { id: feedId },
    data: { lastFetchedAt: new Date() },
  });
}

// Télécharge un flux et enregistre ses articles
// Télécharge et lit un flux de façon sécurisée
export async function parseFeed(url: string) {
  const xml = await fetchFeedText(url);
  return parser.parseString(xml);
}

// Télécharge un flux et enregistre ses articles
export async function refreshFeed(feed: { id: string; url: string }) {
  const parsed = await parseFeed(feed.url);
  await saveArticles(feed.id, parsed.items);
}

// Actualise plusieurs flux, 5 à la fois
export async function refreshMany(feeds: { id: string; url: string }[]) {
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < feeds.length; i += 5) {
    const batch = feeds.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((f) => refreshFeed(f)));
    for (const r of results) {
      if (r.status === "fulfilled") ok++;
      else failed++;
    }
  }
  return { ok, failed };
}