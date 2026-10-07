import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";

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

interface AuthContextType {
  user: User | null;
  login: (username: string, senha: string) => boolean;
  logout: () => void;
  registerResponsavel: (name: string, dataNascimento: string, cpf: string) => { success: boolean; username?: string; senha?: string };
  requestProfessorRole: () => void;
  createAluno: (name: string, cpf: string, turmaId: string, responsavelId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_USER: User = { id: "admin-1", name: "Administrador", username: "admin", role: "ADMIN" };
const DEV_USER: User = { id: "dev-1", name: "Desenvolvedor", username: "dev", role: "DEV" };

// Mocked storage for new users
export const MOCK_DB = {
  users: [
    { ...ADMIN_USER, senha: "AcessoDeAdministradorEscola" },
    { ...DEV_USER, senha: "IssoSimEUmaSenhaForte" },
  ],
  alunos: [] as Aluno[],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check local storage for persistent login
    const savedUser = localStorage.getItem("escolar_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const login = (username: string, senha: string) => {
    // In a real app, this would be an API call
    const foundUser = MOCK_DB.users.find(u => u.username === username && u.senha === senha);
    if (foundUser) {
      const authUser: User = { ...foundUser };
      setUser(authUser);
      localStorage.setItem("escolar_user", JSON.stringify(authUser));
      toast.success(`Bem-vindo, ${authUser.name}!`);
      return true;
    }
    toast.error("Credenciais inválidas. Tente novamente.");
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("escolar_user");
    toast.info("Você saiu do sistema.");
  };

  const requestProfessorRole = () => {
    if (!user) return;
    const updatedUser = { ...user, requestedProfessor: true };
    setUser(updatedUser);
    localStorage.setItem("escolar_user", JSON.stringify(updatedUser));
    
    // Update MOCK_DB
    const dbUser = MOCK_DB.users.find(u => u.id === user.id);
    if (dbUser) dbUser.requestedProfessor = true;
    
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

  const registerResponsavel = (name: string, dataNascimento: string, cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    
    // dataNascimento comes from <input type="date"> as "YYYY-MM-DD"
    const parts = dataNascimento.split("-");
    let cleanDate = dataNascimento.replace(/\D/g, "");
    if (parts.length === 3) {
      // Rearrange to DD MM YYYY
      cleanDate = `${parts[2]}${parts[1]}${parts[0]}`;
    }
    
    const username = name.split(" ")[0].toLowerCase() + cleanCpf.slice(-3);
    const senha = cleanCpf.substring(0, 4) + cleanDate;

    const exists = MOCK_DB.users.find(u => u.username === username || u.cpf === cleanCpf);
    if (exists) {
      toast.error("Já existe um cadastro com este CPF ou Usuário.");
      return { success: false };
    }
    
    const newUser = {
      id: crypto.randomUUID(),
      name,
      username,
      senha,
      cpf: cleanCpf,
      dataNascimento: cleanDate,
      role: "RESPONSAVEL" as const,
    };
    
    MOCK_DB.users.push(newUser);
    
    return { success: true, username, senha };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, registerResponsavel, requestProfessorRole, createAluno }}>
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
