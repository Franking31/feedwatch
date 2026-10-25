import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import Rail from "./rail";

// L'initiale du compte connecté, en rond
async function Avatar() {
  const user = await requireUser();
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <span
      title={user.email}
      aria-label={`Connecté avec ${user.email}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-rail-active text-sm font-bold"
    >
      {initial}
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      <Rail
        userSlot={
          <Suspense fallback={<span className="block h-9 w-9" />}>
            <Avatar />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  );
}