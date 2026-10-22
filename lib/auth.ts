import { timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prisma } from "./prisma";

// Comparaison "à temps constant" : ne révèle rien sur le code par le temps de réponse
function sameCode(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  hooks: {
    // S'exécute avant chaque inscription
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const expected = process.env.SIGNUP_CODE;
      if (!expected) {
        throw new APIError("FORBIDDEN", { message: "Les inscriptions sont fermées." });
      }

      const given = ctx.headers?.get("x-signup-code") ?? "";
      if (!sameCode(given, expected)) {
        throw new APIError("FORBIDDEN", { message: "Code d'invitation invalide." });
      }
    }),
  },
});