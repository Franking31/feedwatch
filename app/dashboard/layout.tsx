import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import SidebarNav from "./sidebar-nav";
import SignOutButton from "./sign-out-button";

async function UserBlock() {
  const user = await requireUser();
  return (
    <div className="border-t border-line pt-4">
      <div className="hidden md:block">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="mb-3 truncate text-xs text-muted">{user.email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex flex-col gap-4 px-4 py-4 md:h-full md:gap-6 md:py-6">
          <p className="text-lg font-bold tracking-tight">Feedwatch</p>
          <SidebarNav />
          <div className="md:mt-auto">
            <Suspense fallback={null}>
              <UserBlock />
            </Suspense>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-10 md:py-12">
        {children}
      </main>
    </div>
  );
}