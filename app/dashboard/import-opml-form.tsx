"use client";

import { useActionState } from "react";
import { importOpml } from "./actions";

export default function ImportOpmlForm() {
  const [state, formAction, pending] = useActionState(importOpml, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Fichier OPML (exporté depuis un autre lecteur RSS)
        <input
          type="file"
          name="file"
          accept=".opml,.xml,text/xml,application/xml"
          className="field"
          required
        />
      </label>

      <button disabled={pending} className="btn self-start">
        {pending ? "Import en cours..." : "Importer"}
      </button>

      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm text-ok">
          {state.success}
        </p>
      )}
    </form>
  );
}