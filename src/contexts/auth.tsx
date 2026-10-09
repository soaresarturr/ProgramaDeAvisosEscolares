import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getSupabase, usernameToEmail } from "@/lib/supabase";
import { desativarPushDesteAparelho } from "@/lib/push";
import { PROFILE_COLUMNS, profileToUser, type ProfileRow } from "@/lib/session";

export interface User {
  id: string;
  name: string;
  username: string; // Used for login
  cpf?: string;
  dataNascimento?: string;
  role: "ADMIN" | "DEV" | "RESPONSAVEL" | "PROFESSOR";
  requestedProfessor?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerResponsavel: (name: string, dataNascimento: string, cpf: string) => Promise<{ success: boolean; username?: string; senha?: string }>;
  requestProfessorRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const fetchProfile = async () => {
    const supabase = getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", auth.user.id).single();
    return data ? profileToUser(data as ProfileRow) : null;
  };

  // Carrega o perfil de quem está logado e acompanha entrada/saída em outras abas
  useEffect(() => {
    void fetchProfile().then(setUser);
    const { data: sub } = getSupabase().auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") setUser(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (username: string, senha: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: senha,
    });
    if (error) {
      toast.error("Credenciais inválidas. Tente novamente.");
      return false;
    }
    const authUser = await fetchProfile();
    if (!authUser) {
      await supabase.auth.signOut();
      toast.error("Conta sem perfil. Fale com a escola.");
      return false;
    }
    // Dados em cache de outra pessoa (mesmo navegador) não podem aparecer para quem entrou
    queryClient.clear();
    setUser(authUser);
    toast.success(`Bem-vindo, ${authUser.name}!`);
    return true;
  };

  const logout = async () => {
    await desativarPushDesteAparelho().catch(() => {});
    await getSupabase().auth.signOut();
    queryClient.clear();
    setUser(null);
    toast.info("Você saiu do sistema.");
  };

  const requestProfessorRole = async () => {
    if (!user) return;
    const { error } = await getSupabase().rpc("solicitar_professor");
    if (error) {
      toast.error("Não foi possível enviar a solicitação.");
      return;
    }
    setUser({ ...user, requestedProfessor: true });
    toast.success("Solicitação enviada! Um administrador irá aprovar o seu perfil de professor.");
  };

  const registerResponsavel = async (name: string, dataNascimento: string, cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("Informe um CPF completo.");
      return { success: false };
    }

    // dataNascimento vem do <input type="date"> como "YYYY-MM-DD"
    const [ano, mes, dia] = dataNascimento.split("-");
    // Só letras sem acento e números: "João" vira "joao" (e-mail com acento é recusado pelo Supabase)
    const primeiroNome = (name.trim().split(/\s+/)[0] ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const username = (primeiroNome || "usuario") + cleanCpf.slice(-3);
    const senha = cleanCpf.substring(0, 4) + `${dia}${mes}${ano}`;

    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: senha,
      options: { data: { name: name.trim(), username, cpf: cleanCpf, data_nascimento: dataNascimento } },
    });
    if (error) {
      console.error("Erro no cadastro:", error.code, error.message);
      const duplicado = error.code === "user_already_exists" || error.code === "email_exists";
      toast.error(
        duplicado
          ? "Já existe um cadastro com este usuário."
          : error.message.includes("Database error")
            ? "Não foi possível criar a conta. Confira se o CPF já foi cadastrado."
            : `Não foi possível criar a conta (${error.code ?? error.message}).`,
      );
      return { success: false };
    }
    // O cadastro entra logado por padrão; saímos para a pessoa fazer o login normalmente.
    await supabase.auth.signOut();
    return { success: true, username, senha };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, registerResponsavel, requestProfessorRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
