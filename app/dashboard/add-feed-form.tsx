"use client";

import { useActionState, useState, useTransition } from "react";
import { addSubscription, previewFeed, type PreviewResult } from "./actions";

export default function AddFeedForm({
  folders,
}: {
  folders: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(addSubscription, null);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, startPreview] = useTransition();

  function handlePreview() {
    setPreview(null);
    startPreview(async () => {
      setPreview(await previewFeed(url));
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        name="url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://site.com/feed"
        className="rounded border p-2"
        required
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!url || previewing}
          className="rounded border p-2 disabled:opacity-50"
        >
          {previewing ? "Lecture..." : "Aperçu"}
        </button>

        <select name="folderId" defaultValue="" className="flex-1 rounded border p-2">
          <option value="">Sans dossier</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <button
          disabled={pending}
          className="rounded bg-blue-600 px-3 text-white disabled:opacity-50"
        >
          {pending ? "Vérification..." : "S'abonner"}
        </button>
      </div>

      {preview && "error" in preview && (
        <p className="text-red-500">{preview.error}</p>
      )}
      {preview && "items" in preview && (
        <div className="rounded border p-3">
          <p className="font-semibold">{preview.title}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {preview.items.map((item) => (
              <li key={item.link}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state?.error && <p className="text-red-500">{state.error}</p>}
      {state?.success && <p className="text-green-500">{state.success}</p>}
    </form>
  );
}