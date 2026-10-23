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
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Adresse du flux RSS
        <input
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://site.com/feed"
          className="field"
          required
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Dossier
          <select name="folderId" defaultValue="" className="field">
            <option value="">Sans dossier</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handlePreview}
          disabled={!url || previewing}
          className="btn"
        >
          {previewing ? "Lecture..." : "Aperçu"}
        </button>

        <button disabled={pending} className="btn btn-primary">
          {pending ? "Vérification..." : "S'abonner"}
        </button>
      </div>

      {preview && "error" in preview && (
        <p role="alert" className="text-sm text-danger">
          {preview.error}
        </p>
      )}

      {preview && "items" in preview && (
        <div className="rounded-md border border-line bg-surface p-4">
          <p className="font-semibold">{preview.title}</p>
          {preview.items.length === 0 ? (
            <p className="text-sm text-muted">
              Ce flux ne contient aucun article pour l'instant.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted">Les derniers articles de ce flux</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {preview.items.map((item) => (
                  <li key={item.link}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.title}
                      <span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

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