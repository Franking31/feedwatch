// Compteur en mémoire : suffisant pour un seul serveur (il se vide au redémarrage)

const hits = new Map<string, number[]>()

// Renvoie false si la limite est dépassée
export function rateLimit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
        hits.set(key, recent);
        return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
}