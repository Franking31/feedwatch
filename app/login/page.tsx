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
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);

    const result =
      mode === "signup"
        ? await signUp.email(
            { name, email, password },
            { headers: { "x-signup-code": inviteCode } }
          )
        : await signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Une erreur est survenue. Réessaie.");
      return;
    }
    router.push("/dashboard/articles");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Feedwatch</h1>
      <p className="mb-10 mt-2 text-muted">
        Tes sources, tes mots-clés, un digest par semaine.
      </p>

      <h2 className="mb-4 text-lg font-semibold">
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Nom
              <input
                className="field"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Code d'invitation
              <input
                className="field"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Mot de passe
          <input
            className="field"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === "signup" && (
            <span className="text-xs font-normal text-muted">8 caractères minimum.</span>
          )}
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          className="btn btn-primary justify-center py-2.5"
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Patiente..."
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>
      </form>

      <button
        type="button"
        className="mt-6 self-start text-sm text-muted underline underline-offset-4 hover:text-ink"
        onClick={() => {
          setError("");
          setMode(mode === "login" ? "signup" : "login");
        }}
      >
        {mode === "login"
          ? "Pas encore de compte ? En créer un"
          : "Déjà un compte ? Se connecter"}
      </button>
    </main>
  );
}