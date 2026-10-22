"use client";

import { useActionState } from "react";
import { importOpml } from "./actions";

export default function ImportOpmlForm() {
  const [state, formAction, pending] = useActionState(importOpml, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        type="file"
        name="file"
        accept=".opml,.xml,text/xml,application/xml"
        className="rounded border p-2"
        required
      />
      <button
        disabled={pending}
        className="self-start rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Import en cours..." : "Importer un fichier OPML"}
      </button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
      {state?.success && <p className="text-green-500">{state.success}</p>}
    </form>
  );
}