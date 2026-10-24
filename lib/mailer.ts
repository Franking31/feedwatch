import nodemailer from "nodemailer";
import { prisma } from "./prisma";

type Source = { n: number; title: string; link: string; feed: string };

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

// Le texte du digest, avec chaque référence [3] transformée en lien
function renderHtml(content: string, sources: Source[], intro: string) {
  const body = content
    .split(/\[(\d{1,3})\]/g)
    .map((part, i) => {
      if (i % 2 === 0) return esc(part).replace(/\n/g, "<br>");
      const s = sources.find((x) => x.n === Number(part));
      if (!s || !isHttp(s.link)) return esc(`[${part}]`);
      return `<a href="${esc(s.link)}" style="color:#2a44d8;text-decoration:none;font-weight:600">[${part}]</a>`;
    })
    .join("");

  const list = sources
    .filter((s) => isHttp(s.link))
    .map(
      (s) =>
        `<li style="margin:0 0 8px"><span style="color:#5b6874">[${s.n}]</span> <a href="${esc(s.link)}" style="color:#15202b">${esc(s.title)}</a> <span style="color:#5b6874">${esc(s.feed)}</span></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#15202b">
<div style="max-width:620px;margin:0 auto;padding:24px 16px">
<h1 style="font-size:22px;margin:0 0 4px">Ton digest Feedwatch</h1>
<p style="margin:0 0 20px;color:#5b6874;font-size:14px">${esc(intro)}</p>
<div style="background:#ffffff;border:1px solid #dce2e9;border-radius:8px;padding:20px;font-size:16px;line-height:1.6">${body}</div>
<h2 style="font-size:16px;margin:24px 0 8px">Sources</h2>
<ul style="padding:0;margin:0;list-style:none;font-size:14px;line-height:1.5">${list}</ul>
</div></body></html>`;
}

function renderText(content: string, sources: Source[], intro: string) {
  const list = sources
    .map((s) => `[${s.n}] ${s.title} (${s.feed})\n${s.link}`)
    .join("\n\n");
  return `${intro}\n\n${content}\n\nSources\n\n${list}\n`;
}

// Envoie un digest par email à l'adresse du compte (uniquement SES digests)
export async function emailDigest(
  digestId: string,
  userId: string
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  if (!mailConfigured()) {
    return { ok: false, error: "L'envoi d'emails n'est pas configuré sur ce serveur." };
  }

  const digest = await prisma.digest.findFirst({
    where: { id: digestId, userId },
    include: { user: { select: { email: true } } },
  });
  if (!digest) return { ok: false, error: "Digest introuvable." };

  const to = digest.user.email;
  const sources = digest.sources as unknown as Source[];
  const intro = `Du ${fmt(digest.periodStart)} au ${fmt(digest.periodEnd)}, ${digest.articleCount} article${digest.articleCount > 1 ? "s" : ""}`;

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
      subject: `Ton digest Feedwatch, du ${fmt(digest.periodStart)} au ${fmt(digest.periodEnd)}`,
      text: renderText(digest.content, sources, intro),
      html: renderHtml(digest.content, sources, intro),
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