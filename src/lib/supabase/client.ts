import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador (só para abrir a sessão vinda dos links de e-mail do Supabase). */
export const createClient = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
