"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      className="rounded bg-black p-2 text-white"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
    >
      Se déconnecter
    </button>
  );
}