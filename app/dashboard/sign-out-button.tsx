"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      className="btn btn-quiet"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
    >
      Se déconnecter
    </button>
  );
}