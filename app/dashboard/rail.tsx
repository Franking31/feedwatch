"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { ArticlesIcon, DigestIcon, FeedIcon, LogoMark, LogoutIcon } from "@/lib/icons";
import ThemeToggle from "./theme-toggle";

const ITEMS = [
  { href: "/dashboard/articles", label: "Articles", Icon: ArticlesIcon },
  { href: "/dashboard/digest", label: "Digest", Icon: DigestIcon },
  { href: "/dashboard", label: "Flux", Icon: FeedIcon },
];

const item =
  "flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium hover:bg-rail-hover";

export default function Rail({ userSlot }: { userSlot: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Ordinateur : barre à gauche */}
      <aside className="hidden w-[4.5rem] shrink-0 flex-col items-center bg-rail py-4 text-rail-ink md:sticky md:top-0 md:flex md:h-screen">
        <Link href="/dashboard/articles" aria-label="Feedwatch, accueil">
          <LogoMark />
        </Link>

        <nav aria-label="Navigation principale" className="mt-6 flex flex-col gap-1">
          {ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`${item} ${isActive(href) ? "bg-rail-active" : ""}`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1">
          <ThemeToggle className={item} />
          <div className="my-2">{userSlot}</div>
          <button type="button" onClick={handleSignOut} className={item}>
            <LogoutIcon />
            <span>Quitter</span>
          </button>
        </div>
      </aside>

      {/* Téléphone : barre en bas */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around bg-rail px-1 py-1 text-rail-ink md:hidden"
      >
        {ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`${item} ${isActive(href) ? "bg-rail-active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
        <ThemeToggle className={item} />
        <button type="button" onClick={handleSignOut} className={item}>
          <LogoutIcon />
          <span>Quitter</span>
        </button>
      </nav>
    </>
  );
}