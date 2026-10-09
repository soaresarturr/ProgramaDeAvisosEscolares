import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { formatCpf } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username.trim(), senha.trim());
    if (success) {
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Entrar no sistema</h1>
          <p className="text-sm text-muted-foreground">
            Insira suas credenciais para acessar o Portal Escolar
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Seu usuário"
              required
              value={username}
              // Só números; pontos e traço entram sozinhos (o login usa apenas os dígitos)
              onChange={(e) => setUsername(formatCpf(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Não tem acesso? Peça à secretaria da escola.
        </p>
      </div>
    </div>
  );
}
