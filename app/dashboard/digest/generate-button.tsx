"use client";

import { useActionState } from "react";
import { generateDigestAction } from "./actions";

export default function GenerateButton() {
  const [state, formAction, pending] = useActionState(generateDigestAction, null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Génération en cours..." : "✨ Générer maintenant"}
      </button>
      {state?.error && <span className="text-sm text-red-500">{state.error}</span>}
    </form>
  );
}