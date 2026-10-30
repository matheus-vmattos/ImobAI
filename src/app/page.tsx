import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";

export default async function Home() {
  const { papel } = await getSessao();
  redirect(papel === "admin" ? "/admin" : "/portal");
}
