import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { MOCK_DB, Aluno } from "@/contexts/auth";
import { INITIAL_TURMAS, buildTurmaLabelFull } from "./turmas";
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
  head: () => ({
    meta: [
      { title: "Alunos | Portal Escolar" },
      { name: "description", content: "Lista de alunos cadastrados na escola." },
    ],
  }),
  component: AlunosPage,
});

function AlunosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  // We use local state to trigger re-renders when MOCK_DB.alunos changes in this session
  const [alunos, setAlunos] = useState<Aluno[]>(MOCK_DB.alunos);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  const parents = MOCK_DB.users.filter((u) => u.role === "RESPONSAVEL");

  function openCreate() {
    setName("");
    setCpf("");
    setTurmaId("");
    setResponsavelId("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!name.trim() || !cpf.trim() || !turmaId || !responsavelId) {
      toast.error("Preencha todos os campos.");
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (MOCK_DB.alunos.some(a => a.cpf === cleanCpf)) {
      toast.error("Já existe um aluno cadastrado com este CPF.");
      return;
    }

    const newAluno: Aluno = {
      id: crypto.randomUUID(),
      name: name.trim(),
      cpf: cleanCpf,
      turmaId,
      responsavelId,
    };

    MOCK_DB.alunos.push(newAluno);
    setAlunos([...MOCK_DB.alunos]);
    toast.success("Aluno cadastrado com sucesso!");
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    const idx = MOCK_DB.alunos.findIndex((a) => a.id === id);
    if (idx !== -1) {
      MOCK_DB.alunos.splice(idx, 1);
      setAlunos([...MOCK_DB.alunos]);
      toast.success("Aluno removido.");
    }
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
          <Button size="lg" className="h-11 w-full sm:w-auto" onClick={openCreate}>
            <Plus className="size-4 mr-2" />
            Adicionar aluno
          </Button>
        </div>

        {alunos.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado ainda.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="size-4 mr-2" />
              Cadastrar primeiro aluno
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y border-y">
            {alunos.map((aluno) => {
              const turma = INITIAL_TURMAS.find((t) => t.id === aluno.turmaId);
              const responsavel = parents.find((p) => p.id === aluno.responsavelId);

              return (
                <div key={aluno.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{aluno.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                      <span className="font-medium text-primary">
                        {turma ? buildTurmaLabelFull(turma) : "Sem turma"}
                      </span>
                      <span>·</span>
                      <span>Responsável: {responsavel?.name || "Desconhecido"}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(aluno.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
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

          <div className="grid gap-4 py-4">
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
                placeholder="Apenas números"
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="turma">Turma</Label>
              <select
                id="turma"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="" disabled>
                  Selecione uma turma...
                </option>
                {INITIAL_TURMAS.map((t) => (
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
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="" disabled>
                    Selecione um pai/mãe...
                  </option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
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
            <Button onClick={handleSave} disabled={parents.length === 0}>
              Salvar aluno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
