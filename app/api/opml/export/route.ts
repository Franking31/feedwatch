import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// Protège les caractères spéciaux du XML
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const feedLine = (title: string, url: string, indent: string) =>
  `${indent}<outline type="rss" text="${esc(title)}" title="${esc(title)}" xmlUrl="${esc(url)}"/>`;

export async function GET() {
  const user = await requireUser();

  const [folders, unfiled] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id },
      include: { subscriptions: { include: { feed: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.subscription.findMany({
      where: { userId: user.id, folderId: null },
      include: { feed: true },
    }),
  ]);

  const lines: string[] = [];

  for (const folder of folders) {
    if (folder.subscriptions.length === 0) continue;
    lines.push(`    <outline text="${esc(folder.name)}" title="${esc(folder.name)}">`);
    for (const s of folder.subscriptions) {
      lines.push(feedLine(s.feed.title, s.feed.url, "      "));
    }
    lines.push("    </outline>");
  }
  for (const s of unfiled) {
    lines.push(feedLine(s.feed.title, s.feed.url, "    "));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Feedwatch - mes abonnements</title></head>
  <body>
${lines.join("\n")}
  </body>
</opml>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="feedwatch.opml"',
    },
  });
}