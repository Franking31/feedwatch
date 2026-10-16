import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) {
    const mapped = v.slice(7);
    return isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  return (
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    /^fe[89ab]/.test(v)
  );
}

// Vérifie qu'une adresse pointe vers un site public
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Adresse invalide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seules les adresses http et https sont autorisées.");
  }
  if (url.username || url.password) throw new Error("Adresse non autorisée.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Port non autorisé.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Adresse non autorisée.");
  }

  const family = isIP(host);
  const addresses = family
    ? [{ address: host, family }]
    : await lookup(host, { all: true });

  for (const { address, family } of addresses) {
    if (
      (family === 4 && isPrivateIPv4(address)) ||
      (family === 6 && isPrivateIPv6(address))
    ) {
      throw new Error("Adresse non autorisée.");
    }
  }
  return url;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo maximum par flux

// Télécharge un flux en vérifiant CHAQUE redirection
export async function fetchFeedText(rawUrl: string): Promise<string> {
  let current = rawUrl;

  for (let hop = 0; hop <= 5; hop++) {
    const url = await assertPublicUrl(current);

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Feedwatch/1.0 (lecteur RSS)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirection invalide.");
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Réponse ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Réponse vide.");

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Flux trop volumineux.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
  throw new Error("Trop de redirections.");
}