import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { registerResponsavel } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  
  const [successData, setSuccessData] = useState<{username: string, senha: string} | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = registerResponsavel(nome, dataNascimento, cpf);
    if (result.success && result.username && result.senha) {
      setSuccessData({ username: result.username, senha: result.senha });
    }
  };

  const finishRegistration = () => {
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Criar nova conta</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro para responsáveis de alunos
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              placeholder="Seu nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              placeholder="Apenas números"
              required
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataNascimento">Data de Nascimento</Label>
            <Input
              id="dataNascimento"
              type="date"
              required
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>
        <div className="text-center text-sm">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </div>
      </div>

      <Dialog open={!!successData} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Conta criada com sucesso!</DialogTitle>
            <DialogDescription>
              Guarde suas credenciais para acessar o sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="rounded-lg border bg-accent/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">Usuário</p>
              <p className="text-lg font-bold text-foreground">{successData?.username}</p>
            </div>
            <div className="rounded-lg border bg-accent/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">Senha</p>
              <p className="text-lg font-bold text-foreground">{successData?.senha}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sua senha foi gerada com os 4 primeiros dígitos do CPF + data de nascimento.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={finishRegistration} className="w-full">
              Ir para o Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
