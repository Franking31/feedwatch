import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

//renvoie la session de l'utilisateur connecté, ou redirige vers a page de connexion si l'utilisateur n'est pas connecté
export async function requireUser(){
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
    return session.user;
}