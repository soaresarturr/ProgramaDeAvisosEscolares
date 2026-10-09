import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { formatCpf } from "@/lib/utils";
import { requireStaff } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import {
  buildTurmaLabelFull,
  dbErrorMessage,
  useAlunos,
  useCriarAluno,
  useRemoverAluno,
  useResponsaveis,
  useTurmas,
} from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/alunos")({
  beforeLoad: requireStaff,
  head: () => ({
    meta: [
      { title: "Alunos | Portal Escolar" },
      { name: "description", content: "Lista de alunos cadastrados na escola." },
    ],
  }),
  component: AlunosPage,
});

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm";

function AlunosPage() {
  const { user } = useAuth();
  // Professor só consulta; cadastrar e remover é com a administração
  const canEdit = user?.role === "ADMIN" || user?.role === "DEV";

  const { data: alunos = [], isLoading } = useAlunos();
  const { data: turmas = [] } = useTurmas();
  const { data: parents = [] } = useResponsaveis();
  const criarAluno = useCriarAluno();
  const removerAluno = useRemoverAluno();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  function openCreate() {
    setName("");
    setCpf("");
    setTurmaId("");
    setResponsavelId("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!name.trim() || !turmaId || !responsavelId) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      toast.error("Informe o CPF completo do aluno.");
      return;
    }
    criarAluno.mutate(
      { name, cpf, turmaId, responsavelId },
      {
        onSuccess: () => {
          toast.success("Aluno cadastrado com sucesso!");
          setDialogOpen(false);
        },
        onError: (e) =>
          toast.error(
            (e as { code?: string }).code === "23505"
              ? "Já existe um aluno cadastrado com este CPF."
              : dbErrorMessage(e),
          ),
      },
    );
  }

  function handleDelete(id: string) {
    removerAluno.mutate(id, {
      onSuccess: () => toast.success("Aluno removido."),
      onError: (e) => toast.error(dbErrorMessage(e)),
    });
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Alunos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {alunos.length} {alunos.length === 1 ? "aluno cadastrado" : "alunos cadastrados"}
            </p>
          </div>
          {canEdit && (
            <Button className="h-10 self-start px-4 sm:h-11 sm:self-auto sm:px-6" onClick={openCreate}>
              <Plus className="size-4" />
              Adicionar aluno
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : alunos.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Nenhum aluno cadastrado ainda.</p>
        ) : (
          <div className="mt-6 divide-y border-y">
            {alunos.map((aluno) => {
              const turma = turmas.find((t) => t.id === aluno.turmaId);
              return (
                <div key={aluno.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{aluno.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:text-sm">
                      <span className="font-medium text-primary">
                        {turma ? buildTurmaLabelFull(turma) : "Sem turma"}
                      </span>
                      <span>·</span>
                      <span>Responsável: {aluno.responsavelNome ?? "Desconhecido"}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${aluno.name}`}
                      disabled={removerAluno.isPending}
                      onClick={() => handleDelete(aluno.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Aluno</DialogTitle>
            <DialogDescription>Cadastre um aluno e vincule-o à sua turma e responsável.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome do aluno</Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="turma">Turma</Label>
              <select id="turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={selectClass}>
                <option value="" disabled>
                  Selecione uma turma...
                </option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {buildTurmaLabelFull(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="responsavel">Responsável</Label>
              {parents.length === 0 ? (
                <p className="text-sm text-destructive">
                  Nenhum responsável cadastrado. Crie uma conta de responsável primeiro.
                </p>
              ) : (
                <select
                  id="responsavel"
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Selecione um pai/mãe...
                  </option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.username})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={parents.length === 0 || criarAluno.isPending}>
              {criarAluno.isPending ? "Salvando..." : "Salvar aluno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
