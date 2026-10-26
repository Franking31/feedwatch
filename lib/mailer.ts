import nodemailer from "nodemailer";
import { prisma } from "./prisma";

type Source = { n: number; title: string; link: string; feed: string };
type Block = { label: string; content: string; sources: Source[] };

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isHttp = (u: string) => /^https?:\/\//i.test(u);

const fmt = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });

export function mailConfigured(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_APP_PASSWORD;
}

// Une section : le texte avec ses références [3] en liens, puis ses sources
function renderBlockHtml(b: Block, showTitle: boolean) {
  const body = b.content
    .split(/\[(\d{1,3})\]/g)
    .map((part, i) => {
      if (i % 2 === 0) return esc(part).replace(/\n/g, "<br>");
      const s = b.sources.find((x) => x.n === Number(part));
      if (!s || !isHttp(s.link)) return esc(`[${part}]`);
      return `<a href="${esc(s.link)}" style="color:#2a44d8;text-decoration:none;font-weight:600">[${part}]</a>`;
    })
    .join("");

  const list = b.sources
    .filter((s) => isHttp(s.link))
    .map(
      (s) =>
        `<li style="margin:0 0 8px"><span style="color:#5b6874">[${s.n}]</span> <a href="${esc(s.link)}" style="color:#15202b">${esc(s.title)}</a> <span style="color:#5b6874">${esc(s.feed)}</span></li>`
    )
    .join("");

  return `${showTitle ? `<h2 style="font-size:18px;margin:32px 0 10px">${esc(b.label)}</h2>` : ""}
<div style="background:#ffffff;border:1px solid #dce2e9;border-radius:8px;padding:20px;font-size:16px;line-height:1.6;margin-top:${showTitle ? 0 : 20}px">${body}</div>
<p style="margin:16px 0 6px;font-size:14px;font-weight:bold">Sources</p>
<ul style="padding:0;margin:0;list-style:none;font-size:14px;line-height:1.5">${list}</ul>`;
}

function renderHtml(blocks: Block[], intro: string) {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#15202b">
<div style="max-width:620px;margin:0 auto;padding:24px 16px">
<h1 style="font-size:22px;margin:0 0 4px">Ton digest Feedwatch</h1>
<p style="margin:0;color:#5b6874;font-size:14px">${esc(intro)}</p>
${blocks.map((b) => renderBlockHtml(b, blocks.length > 1)).join("\n")}
</div></body></html>`;
}

function renderText(blocks: Block[], intro: string) {
  const parts = blocks.map((b) => {
    const list = b.sources.map((s) => `[${s.n}] ${s.title} (${s.feed})\n${s.link}`).join("\n\n");
    return `${blocks.length > 1 ? `${b.label}\n\n` : ""}${b.content}\n\nSources\n\n${list}`;
  });
  return `${intro}\n\n${parts.join("\n\n----------\n\n")}\n`;
}

// Envoie un ou plusieurs digests dans UN SEUL email, à l'adresse du compte (uniquement SES digests)
export async function emailDigests(
  ids: string[],
  userId: string
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  if (!mailConfigured()) {
    return { ok: false, error: "L'envoi d'emails n'est pas configuré sur ce serveur." };
  }

  const digests = await prisma.digest.findMany({
    where: { id: { in: ids.slice(0, 10) }, userId },
    include: { user: { select: { email: true } } },
  });
  if (digests.length === 0) return { ok: false, error: "Digest introuvable." };

  digests.sort((a, b) => a.label.localeCompare(b.label, "fr"));

  const to = digests[0].user.email;
  const start = new Date(Math.min(...digests.map((d) => d.periodStart.getTime())));
  const end = new Date(Math.max(...digests.map((d) => d.periodEnd.getTime())));
  const total = digests.reduce((n, d) => n + d.articleCount, 0);
  const intro = `Du ${fmt(start)} au ${fmt(end)}, ${total} article${total > 1 ? "s" : ""}`;

  const blocks: Block[] = digests.map((d) => ({
    label: d.label,
    content: d.content,
    sources: d.sources as unknown as Source[],
  }));

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"${(process.env.SMTP_FROM_NAME || "Feedwatch").replace(/["\r\n]/g, "")}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Ton digest Feedwatch, du ${fmt(start)} au ${fmt(end)}`,
      text: renderText(blocks, intro),
      html: renderHtml(blocks, intro),
    });
  } catch (err) {
    console.error("Envoi du digest échoué :", err);
    return {
      ok: false,
      error: "L'envoi a échoué. Vérifie la configuration email du serveur.",
    };
  }

  return { ok: true, to };
}

export function emailDigest(digestId: string, userId: string) {
  return emailDigests([digestId], userId);
}