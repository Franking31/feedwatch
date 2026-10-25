import { decodeHTML } from "entities";

// Transforme un texte venu d'un flux (avec balises et codes comme &#39;) en texte simple
export function cleanText(input: string): string {
  let s = input;

  // Deux passages : certains flux encodent leur HTML deux fois
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/<(br|p|div|li)\b[^>]*>/gi, " ") // sauts de ligne : un espace
      .replace(/<\/?[a-zA-Z][^>]*>/g, ""); // vraies balises : supprimées
    s = decodeHTML(s);
  }

  return s.replace(/\s+/g, " ").trim();
}