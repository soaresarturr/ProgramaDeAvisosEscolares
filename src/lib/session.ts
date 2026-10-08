import { createServerFn } from "@tanstack/react-start";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "@tanstack/react-router";

import type { User } from "@/contexts/auth";

export interface ProfileRow {
  id: string;
  name: string;
  username: string;
  cpf: string | null;
  data_nascimento: string | null;
  role: User["role"];
  requested_professor: boolean;
}

export const PROFILE_COLUMNS = "id, name, username, cpf, data_nascimento, role, requested_professor";

export function profileToUser(p: ProfileRow): User {
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    role: p.role,
    requestedProfessor: p.requested_professor,
    ...(p.cpf ? { cpf: p.cpf } : {}),
    ...(p.data_nascimento ? { dataNascimento: p.data_nascimento } : {}),
  };
}

// Valida a sessão no servidor: o Supabase confere o token a cada chamada, então um cookie
// inventado não passa. O perfil vem do banco (com RLS), nunca do navegador.
const getSessionFn = createServerFn({ method: "GET" }).handler(async (): Promise<User | null> => {
  const supabase = createServerClient(
    import.meta.env["VITE_SUPABASE_URL"] as string,
    import.meta.env["VITE_SUPABASE_ANON_KEY"] as string,
    {
      cookies: {
        getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
        setAll: (list) => list.forEach(({ name, value, options }) => setCookie(name, value, options)),
      },
    },
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", auth.user.id)
    .single();
  return profile ? profileToUser(profile as ProfileRow) : null;
});

// Usado em beforeLoad das rotas protegidas: sem sessão válida, volta para o login.
export async function requireAuth() {
  const user = await getSessionFn();
  if (!user) throw redirect({ to: "/login" });
  return { user };
}

// Telas só para administração (ADMIN/DEV); os demais perfis voltam para o início.
export async function requireAdmin() {
  const { user } = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "DEV") throw redirect({ to: "/dashboard" });
  return { user };
}
