"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result =
      mode === "signup"
        ? await signUp.email(
            { name, email, password },
            { headers: { "x-signup-code": inviteCode } }
          )
        : await signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Une erreur est survenue");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto mt-20 max-w-sm p-4">
      <h1 className="mb-4 text-2xl font-bold">
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <>
            <input
              className="rounded border p-2"
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="rounded border p-2"
              placeholder="Code d'invitation"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
            />
          </>
        )}
        <input
          className="rounded border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded border p-2"
          type="password"
          placeholder="Mot de passe (8 caractères min.)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-600">{error}</p>}
        <button className="rounded bg-black p-2 text-white" type="submit">
          {mode === "login" ? "Se connecter" : "S'inscrire"}
        </button>
      </form>

      <button
        className="mt-4 text-sm underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Pas de compte ? S'inscrire"
          : "Déjà un compte ? Se connecter"}
      </button>
    </main>
  );
}