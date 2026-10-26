import "dotenv/config";
import { providerOrder, generateTextDetailed } from "../lib/llm";

async function main() {
  const order = providerOrder();
  console.log("Ordre d'essai :", order.length ? order.join(" puis ") : "(aucune clé trouvée)");

  try {
    const r = await generateTextDetailed({
      system: "Réponds en une courte phrase.",
      user: "Dis bonjour en français.",
      maxTokens: 1000,
    });
    console.log(`Répondu par   : ${r.provider} (${r.model})`);
    console.log("Réponse       :", r.text);
  } catch (err) {
    console.log("ÉCHEC         :", err instanceof Error ? err.message : err);
  }
}

main();