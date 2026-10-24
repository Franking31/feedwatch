"use client";

import { useActionState } from "react";
import { sendDigestEmailAction } from "./actions";

export default function EmailButton({ digestId }: { digestId: string }) {
  const [state, formAction, pending] = useActionState(sendDigestEmailAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="digestId" value={digestId} />
      <button disabled={pending} className="btn">
        {pending ? "Envoi..." : "M'envoyer par email"}
      </button>
      {state?.success && (
        <p role="status" className="text-sm text-ok">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}