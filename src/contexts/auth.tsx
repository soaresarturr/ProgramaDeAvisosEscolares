import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { toast } from "sonner";

import { getSupabase, usernameToEmail } from "@/lib/supabase";
import { PROFILE_COLUMNS, profileToUser, type ProfileRow } from "@/lib/session";

export interface User {
  id: string;
  name: string;
  username: string; // Used for login
  email?: string; // Optional for admin/dev
  cpf?: string;
  dataNascimento?: string;
  role: "ADMIN" | "DEV" | "RESPONSAVEL" | "PROFESSOR";
  requestedProfessor?: boolean;
}

export interface Aluno {
  id: string;
  name: string;
  cpf: string;
  turmaId: string;
  responsavelId: string;
}

export interface Comunicado {
  id: string;
  titulo: string;
  mensagem: string;
  /** null = toda a escola */
  turmaId: string | null;
  destinoLabel: string;
  autor: string;
  criadoEm: string;
}

export interface Notificacao {
  id: string;
  userId: string;
  comunicadoId: string;
  titulo: string;
  lida: boolean;
  criadoEm: string;
}

type DbUser = User & { senha: string };

interface AuthContextType {
  user: User | null;
  login: (username: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerResponsavel: (name: string, dataNascimento: string, cpf: string) => Promise<{ success: boolean; username?: string; senha?: string }>;
  requestProfessorRole: () => Promise<void>;
  createAluno: (name: string, cpf: string, turmaId: string, responsavelId: string) => boolean;
  criarComunicado: (titulo: string, mensagem: string, turmaId: string | null, destinoLabel: string) => void;
  notificacoes: Notificacao[];
  marcarNotificacoesLidas: () => void;
  aprovarProfessor: (userId: string) => void;
  recusarProfessor: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mocked storage for new users
export const MOCK_DB = {
  comunicados: [
    { id: "c1", titulo: "Reunião de pais", mensagem: "", turmaId: null, destinoLabel: "Toda a escola", autor: "Administrador", criadoEm: "2026-09-18T12:00:00" },
    { id: "c2", titulo: "Passeio do 7º Ano", mensagem: "", turmaId: null, destinoLabel: "Toda a escola", autor: "Administrador", criadoEm: "2026-09-16T12:00:00" },
    { id: "c3", titulo: "Lembrete sobre o feriado", mensagem: "", turmaId: null, destinoLabel: "Toda a escola", autor: "Administrador", criadoEm: "2026-09-12T12:00:00" },
  ] as Comunicado[],
  notificacoes: [] as Notificacao[],
  users: [] as DbUser[], // temporário: some quando as telas migrarem para o banco
  alunos: [] as Aluno[],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setRevision] = useState(0);
  const refresh = () => setRevision((r) => r + 1);

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
    setUser(authUser);
    toast.success(`Bem-vindo, ${authUser.name}!`);
    return true;
  };

  const logout = async () => {
    await getSupabase().auth.signOut();
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

  const createAluno = (name: string, cpf: string, turmaId: string, responsavelId: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (MOCK_DB.alunos.some(a => a.cpf === cleanCpf)) {
      toast.error("Já existe um aluno cadastrado com este CPF.");
      return false;
    }
    
    const newAluno: Aluno = {
      id: crypto.randomUUID(),
      name: name.trim(),
      cpf: cleanCpf,
      turmaId,
      responsavelId,
    };
    
    MOCK_DB.alunos.push(newAluno);
    toast.success("Aluno cadastrado com sucesso!");
    return true;
  };

  const registerResponsavel = async (name: string, dataNascimento: string, cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("Informe um CPF completo.");
      return { success: false };
    }

    // dataNascimento vem do <input type="date"> como "YYYY-MM-DD"
    const [ano, mes, dia] = dataNascimento.split("-");
    const username = (name.trim().split(" ")[0] ?? "").toLowerCase() + cleanCpf.slice(-3);
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

  const notificacoes = user ? MOCK_DB.notificacoes.filter((n) => n.userId === user.id) : [];

  // Avisa no navegador (se a pessoa permitiu) quando chega uma notificação nova
  const avisadas = useRef(new Set<string>());
  useEffect(() => {
    for (const n of notificacoes) {
      if (n.lida || avisadas.current.has(n.id)) continue;
      avisadas.current.add(n.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Novo comunicado", { body: n.titulo });
      }
    }
  });

  const criarComunicado = (titulo: string, mensagem: string, turmaId: string | null, destinoLabel: string) => {
    const comunicado: Comunicado = {
      id: crypto.randomUUID(),
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      turmaId,
      destinoLabel,
      autor: user?.name ?? "Escola",
      criadoEm: new Date().toISOString(),
    };
    MOCK_DB.comunicados.unshift(comunicado);

    // Quem recebe: todos os responsáveis, ou só os que têm filho na turma escolhida
    const destinatarios = MOCK_DB.users.filter(
      (u) =>
        u.role === "RESPONSAVEL" &&
        (turmaId === null || MOCK_DB.alunos.some((a) => a.responsavelId === u.id && a.turmaId === turmaId)),
    );
    for (const d of destinatarios) {
      MOCK_DB.notificacoes.unshift({
        id: crypto.randomUUID(),
        userId: d.id,
        comunicadoId: comunicado.id,
        titulo: comunicado.titulo,
        lida: false,
        criadoEm: comunicado.criadoEm,
      });
    }
    refresh();
    toast.success(
      destinatarios.length === 0
        ? "Comunicado salvo. Ainda não há responsáveis para avisar."
        : `Comunicado enviado! ${destinatarios.length} ${destinatarios.length === 1 ? "responsável avisado" : "responsáveis avisados"}.`,
    );
  };

  const marcarNotificacoesLidas = () => {
    if (!user) return;
    MOCK_DB.notificacoes.forEach((n) => {
      if (n.userId === user.id) n.lida = true;
    });
    refresh();
  };

  const aprovarProfessor = (userId: string) => {
    const dbUser = MOCK_DB.users.find((u) => u.id === userId);
    if (!dbUser) return;
    dbUser.role = "PROFESSOR";
    dbUser.requestedProfessor = false;
    refresh();
    toast.success(`${dbUser.name} agora é professor(a).`);
  };

  const recusarProfessor = (userId: string) => {
    const dbUser = MOCK_DB.users.find((u) => u.id === userId);
    if (!dbUser) return;
    dbUser.requestedProfessor = false;
    refresh();
    toast.info("Solicitação recusada.");
  };

  return (
    <AuthContext.Provider
      value={{
        user, login, logout, registerResponsavel, requestProfessorRole, createAluno,
        criarComunicado, notificacoes, marcarNotificacoesLidas, aprovarProfessor, recusarProfessor,
      }}
    >
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
