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

/**
 * O Supabase Auth exige e-mail; o usuário (sempre numérico) vira um e-mail interno.
 * Só os dígitos contam, então "123.456.789-01" e "12345678901" dão no mesmo login.
 * Pais e professores: CPF (11 dígitos). Administração: número próprio, com menos dígitos.
 */
export function usernameToEmail(login: string) {
  return `${login.replace(/\D/g, "")}@escola.local`;
}
