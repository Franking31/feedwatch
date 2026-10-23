"use client";

import { useActionState } from "react";
import { generateDigestAction } from "./actions";

export default function GenerateButton() {
  const [state, formAction, pending] = useActionState(generateDigestAction, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button disabled={pending} className="btn btn-primary">
        {pending ? "Génération..." : "Générer maintenant"}
      </button>
      {state?.error && (
        <p role="alert" className="max-w-xs text-right text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}