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
    // A senha vale exatamente como foi digitada (sem ajustes): com pontos ou traço, ela não confere.
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

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
