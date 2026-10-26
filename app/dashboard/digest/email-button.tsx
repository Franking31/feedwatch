"use client";

import { useActionState } from "react";
import { sendDigestEmailAction } from "./actions";

export default function EmailButton({
  digestIds,
  label = "M'envoyer par email",
}: {
  digestIds: string[];
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(sendDigestEmailAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      {digestIds.map((id) => (
        <input key={id} type="hidden" name="digestId" value={id} />
      ))}
      <button disabled={pending} className="btn">
        {pending ? "Envoi..." : label}
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