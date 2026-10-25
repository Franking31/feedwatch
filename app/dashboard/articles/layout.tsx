import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { getTree } from "@/lib/unread-counts";
import FolderTree from "./folder-tree";

async function Panel() {
  const user = await requireUser();
  const data = await getTree(user.id);
  return <FolderTree data={data} />;
}

export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface md:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto p-3">
          <Suspense fallback={<p className="p-2 text-sm text-muted">Chargement...</p>}>
            <Panel />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}