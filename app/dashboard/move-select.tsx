"use client";

import { moveSubscription } from "./actions";

export default function MoveSelect({
  subscriptionId,
  folderId,
  folders,
}: {
  subscriptionId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
}) {
  return (
    <form action={moveSubscription}>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <select
        name="folderId"
        defaultValue={folderId ?? ""}
        aria-label="Dossier de ce flux"
        className="field w-auto py-1 text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Sans dossier</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </form>
  );
}