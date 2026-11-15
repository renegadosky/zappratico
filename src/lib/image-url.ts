/**
 * Normaliza URLs de imagem coladas pelo usuário.
 * - Extrai a URL real de links do Google Images (/imgres?imgurl=...)
 * - Extrai de redirecionadores comuns (url=, u=, q=)
 * - Remove espaços e pega só o primeiro link
 */
export function normalizeImageUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().split(/\s+/)[0];
  if (!s) return "";

  try {
    const u = new URL(s);
    // Google Images: /imgres?imgurl=...
    const candidates = ["imgurl", "url", "u", "q", "media"];
    for (const key of candidates) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) {
        s = decodeURIComponent(v);
        break;
      }
    }
  } catch {
    /* não é URL absoluta — devolve como está */
  }

  return s;
}

/** True se parece uma URL http(s) plausível para imagem. */
export function isLikelyImageUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
