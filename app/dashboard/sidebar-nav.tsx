"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard/articles", label: "Articles" },
  { href: "/dashboard/digest", label: "Digest" },
  { href: "/dashboard", label: "Flux et dossiers" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-1 overflow-x-auto md:flex-col"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}