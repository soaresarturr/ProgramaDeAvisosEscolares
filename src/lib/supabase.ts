import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Cliente do Supabase para uso no navegador (a sessão fica em cookies). */
export function getSupabase() {
  if (!client) {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;
    if (!url || !key) {
      throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
    }
    client = createBrowserClient(url, key);
  }
  return client;
}

/** O Supabase Auth exige e-mail; o usuário digitado vira um e-mail interno. */
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@escola.local`;
