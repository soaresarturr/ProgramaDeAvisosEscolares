import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth";
import { formatCpf, isCpfValido } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import {
  type Credenciais,
  type Papel,
  type Usuario,
  buildTurmaLabelFull,
  useAlunos,
  useCriarUsuario,
  useRemoverUsuario,
  useTurmas,
  useUsuarios,
} from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/usuarios")({
  beforeLoad: requireAdmin,
  head: () => ({
    meta: [{ title: "Usuários | Portal Escolar" }],
  }),
  component: UsuariosPage,
});

const PAPEL_LABEL: Record<Papel, string> = {
  RESPONSAVEL: "Responsável",
  PROFESSOR: "Professor(a)",
  ADMIN: "Administração",
  DEV: "Desenvolvedor",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm";

interface FilhoForm {
  nome: string;
  cpf: string;
  turmaId: string;
}

const filhoVazio = (): FilhoForm => ({ nome: "", cpf: "", turmaId: "" });

function UsuariosPage() {
  const { user } = useAuth();
  const { data: usuarios = [], isLoading } = useUsuarios();
  const { data: alunos = [] } = useAlunos();
  const removerUsuario = useRemoverUsuario();
  const [remover, setRemover] = useState<Usuario | null>(null);

  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [credenciais, setCredenciais] = useState<(Credenciais & { nome: string; aviso?: string }) | null>(null);

  const termo = busca.trim().toLowerCase();
  const termoCpf = busca.replace(/\D/g, "");
  const lista = usuarios.filter(
    (u) =>
      !termo ||
      u.name.toLowerCase().includes(termo) ||
      (termoCpf.length > 0 && (u.cpf ?? "").includes(termoCpf)),
  );

  // ADMIN remove pais e professores; só o DEV remove administradores. DEV e a própria conta, nunca.
  const podeRemover = (u: Usuario) =>
    u.id !== user?.id && u.role !== "DEV" && (u.role !== "ADMIN" || user?.role === "DEV");

  const filhosDe = (u: Usuario) => alunos.filter((a) => a.responsavelId === u.id);

  const confirmarRemocao = (u: Usuario) =>
    removerUsuario.mutate(u.id, {
      onSuccess: () => {
        toast.success(`${u.name} foi removido(a).`);
        setRemover(null);
      },
      onError: (e) => toast.error(e.message),
    });

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Usuários</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie o acesso dos pais e professores. O usuário é o CPF.
            </p>
          </div>
          <Button className="h-10 self-start px-4 sm:h-11 sm:self-auto sm:px-6" onClick={() => setCriando(true)}>
            <UserPlus className="size-4" />
            Novo usuário
          </Button>
        </div>

        <div className="mt-6 max-w-sm">
          <Input
            placeholder="Buscar por nome ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar usuário"
          />
        </div>

        <div className="mt-4 divide-y border-y">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && lista.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          )}
          {lista.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {PAPEL_LABEL[u.role]} · {u.cpf ? formatCpf(u.cpf) : `usuário: ${u.username}`}
                </p>
              </div>
              {podeRemover(u) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${u.name}`}
                  onClick={() => setRemover(u)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {criando && (
        <NovoUsuarioDialog
          podeCriarAdmin={user?.role === "DEV"}
          onClose={() => setCriando(false)}
          onCriado={(c) => {
            setCriando(false);
            setCredenciais(c);
          }}
        />
      )}

      <Dialog open={!!remover} onOpenChange={(aberto) => !aberto && !removerUsuario.isPending && setRemover(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover cadastro</DialogTitle>
            <DialogDescription>
              A conta de <strong>{remover?.name}</strong> será apagada e a pessoa não conseguirá mais
              entrar. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {remover && filhosDe(remover).length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Os filhos também serão removidos:</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {filhosDe(remover).map((f) => (
                  <li key={f.id}>{f.name}</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemover(null)} disabled={removerUsuario.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={removerUsuario.isPending}
              onClick={() => remover && confirmarRemocao(remover)}
            >
              {removerUsuario.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {credenciais && <CredenciaisDialog dados={credenciais} onClose={() => setCredenciais(null)} />}
    </AdminShell>
  );
}

/* ── Novo usuário: 1) dados  2) filhos (só responsável) ─────────── */

function NovoUsuarioDialog({
  podeCriarAdmin,
  onClose,
  onCriado,
}: {
  podeCriarAdmin: boolean;
  onClose: () => void;
  onCriado: (c: Credenciais & { nome: string; aviso?: string }) => void;
}) {
  const qc = useQueryClient();
  const criarUsuario = useCriarUsuario();
  const { data: turmas = [] } = useTurmas();

  const [passo, setPasso] = useState<1 | 2>(1);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [papel, setPapel] = useState<Papel>("RESPONSAVEL");
  const [filhos, setFilhos] = useState<FilhoForm[]>([filhoVazio()]);
  const [salvando, setSalvando] = useState(false);

  const validarPasso1 = () => {
    if (nome.trim().split(/\s+/).length < 2) return "Informe o nome completo.";
    if (!isCpfValido(cpf)) return "CPF inválido. Confira os números.";
    return null;
  };

  const avancar = () => {
    const erro = validarPasso1();
    if (erro) {
      toast.error(erro);
      return;
    }
    if (papel === "RESPONSAVEL") setPasso(2);
    else void criar([]);
  };

  const atualizarFilho = (i: number, campo: keyof FilhoForm, valor: string) =>
    setFilhos((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  async function criar(filhosParaSalvar: FilhoForm[]) {
    // Confere os filhos antes de criar a conta, para não deixar cadastro pela metade
    for (const f of filhosParaSalvar) {
      if (!f.nome.trim() || !f.turmaId) {
        toast.error("Preencha nome e turma de cada filho.");
        return;
      }
      if (!isCpfValido(f.cpf)) {
        toast.error(`CPF inválido para ${f.nome || "o filho"}.`);
        return;
      }
    }

    setSalvando(true);
    try {
      const conta = await criarUsuario.mutateAsync({ nome, cpf, papel });

      // Filhos: gravados pela administração direto no banco (o RLS permite ao admin)
      const falhas: string[] = [];
      for (const f of filhosParaSalvar) {
        const { error } = await getSupabase().from("alunos").insert({
          name: f.nome.trim(),
          cpf: f.cpf.replace(/\D/g, ""),
          turma_id: f.turmaId,
          responsavel_id: conta.userId,
        });
        if (error) falhas.push(error.code === "23505" ? `${f.nome} (CPF já cadastrado)` : f.nome);
      }
      if (filhosParaSalvar.length > 0) {
        void qc.invalidateQueries({ queryKey: ["alunos"] });
        void qc.invalidateQueries({ queryKey: ["turmas"] });
        void qc.invalidateQueries({ queryKey: ["responsaveis"] });
      }

      onCriado({
        login: conta.login,
        senha: conta.senha,
        nome: nome.trim(),
        ...(falhas.length > 0
          ? { aviso: `Conta criada, mas não foi possível cadastrar: ${falhas.join(", ")}. Cadastre em Alunos.` }
          : {}),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  const filhosPreenchidos = filhos.filter((f) => f.nome.trim() || f.cpf.trim() || f.turmaId);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !salvando && onClose()}>
      <DialogContent className="sm:max-w-md">
        {passo === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>O login será o CPF e a senha, o primeiro nome + CPF.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="u-nome">Nome completo</Label>
                <Input id="u-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-cpf">CPF</Label>
                <Input
                  id="u-cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-papel">Perfil</Label>
                <select
                  id="u-papel"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as Papel)}
                  className={selectClass}
                >
                  <option value="RESPONSAVEL">Responsável (pai/mãe)</option>
                  <option value="PROFESSOR">Professor(a)</option>
                  {podeCriarAdmin && <option value="ADMIN">Administração</option>}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={avancar} disabled={salvando}>
                {papel === "RESPONSAVEL" ? "Próximo" : salvando ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Filhos de {nome.trim().split(/\s+/)[0]}</DialogTitle>
              <DialogDescription>Opcional: dá para adicionar depois em Alunos.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {filhos.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Filho {i + 1}</span>
                    {filhos.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover filho ${i + 1}`}
                        onClick={() => setFilhos((fs) => fs.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Nome do aluno"
                    aria-label={`Nome do filho ${i + 1}`}
                    value={f.nome}
                    onChange={(e) => atualizarFilho(i, "nome", e.target.value)}
                  />
                  <Input
                    placeholder="CPF do aluno"
                    aria-label={`CPF do filho ${i + 1}`}
                    inputMode="numeric"
                    maxLength={14}
                    value={f.cpf}
                    onChange={(e) => atualizarFilho(i, "cpf", formatCpf(e.target.value))}
                  />
                  <select
                    aria-label={`Turma do filho ${i + 1}`}
                    value={f.turmaId}
                    onChange={(e) => atualizarFilho(i, "turmaId", e.target.value)}
                    className={selectClass}
                  >
                    <option value="" disabled>
                      Selecione a turma...
                    </option>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {buildTurmaLabelFull(t)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => setFilhos((fs) => [...fs, filhoVazio()])}
              >
                <Plus className="size-3.5" />
                Outro filho
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasso(1)} disabled={salvando}>
                Voltar
              </Button>
              <Button onClick={() => void criar(filhosPreenchidos)} disabled={salvando}>
                {salvando ? "Criando..." : filhosPreenchidos.length > 0 ? "Criar conta e filhos" : "Criar sem filhos"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Credenciais: copiar e imprimir ──────────────────────────── */

function CredenciaisDialog({
  dados,
  onClose,
}: {
  dados: Credenciais & { nome: string; aviso?: string };
  onClose: () => void;
}) {
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const texto =
    `Olá, ${dados.nome.split(" ")[0]}! Seu acesso ao Portal Escolar:\n` +
    `Site: ${site}\nUsuário: ${dados.login}\nSenha: ${dados.senha}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const imprimir = () => {
    const janela = window.open("", "_blank", "width=420,height=500");
    if (!janela) {
      toast.error("Libere as janelas pop-up para imprimir.");
      return;
    }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Acesso</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 4px}
      p{margin:4px 0}.box{border:1px dashed #999;border-radius:8px;padding:16px;margin-top:16px}
      strong{font-family:ui-monospace,monospace;font-size:18px}</style></head><body>
      <h1>Portal Escolar</h1><p>${esc(dados.nome)}</p>
      <div class="box"><p>Site: ${esc(site)}</p><p>Usuário: <strong>${esc(dados.login)}</strong></p>
      <p>Senha: <strong>${esc(dados.senha)}</strong></p></div></body></html>`);
    janela.document.close();
    janela.focus();
    janela.print();
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Acesso de {dados.nome.split(" ")[0]}</DialogTitle>
          <DialogDescription>Entregue estes dados para a pessoa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-accent/30 p-4 text-sm">
          <p>
            Usuário: <strong className="font-mono">{dados.login}</strong>
          </p>
          <p>
            Senha: <strong className="font-mono">{dados.senha}</strong>
          </p>
        </div>
        {dados.aviso && <p className="text-xs text-destructive">{dados.aviso}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => void copiar()}>
            <Copy className="size-3.5" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={imprimir}>
            <Printer className="size-3.5" />
            Imprimir
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
