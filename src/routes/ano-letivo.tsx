import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Types ────────────────────────────────────────────────────── */

type Status = "aprovado" | "reprovado" | null;

interface Turma {
  id: string;
  serie: string;
  sufixo: string;
}

interface Aluno {
  id: string;
  name: string;
  turmaId: string;
}

/* ── Helpers (mirrored from turmas.tsx) ───────────────────────── */

const SERIES = [
  { value: "J1", label: "Jardim 1", order: 0 },
  { value: "J2", label: "Jardim 2", order: 1 },
  { value: "1", label: "1º Ano", order: 2 },
  { value: "2", label: "2º Ano", order: 3 },
];

function getSerieLabel(value: string): string {
  return SERIES.find((s) => s.value === value)?.label ?? value;
}

function getSerieOrder(value: string): number {
  return SERIES.find((s) => s.value === value)?.order ?? 99;
}

function buildTurmaLabel(serie: string, sufixo: string): string {
  return `${getSerieLabel(serie)} — Turma ${sufixo}`;
}

/* ── Mock data ────────────────────────────────────────────────── */

const TURMAS: Turma[] = [
  { id: "1", serie: "J1", sufixo: "A" },
  { id: "2", serie: "J1", sufixo: "B" },
  { id: "3", serie: "J2", sufixo: "A" },
  { id: "4", serie: "1", sufixo: "A" },
  { id: "5", serie: "1", sufixo: "B" },
  { id: "6", serie: "2", sufixo: "A" },
];

const ALUNOS: Aluno[] = [
  { id: "a1", name: "João da Silva", turmaId: "1" },
  { id: "a2", name: "Maria Oliveira", turmaId: "1" },
  { id: "a3", name: "Pedro Santos", turmaId: "2" },
  { id: "a4", name: "Ana Costa", turmaId: "3" },
  { id: "a5", name: "Lucas Souza", turmaId: "3" },
  { id: "a6", name: "Fernanda Lima", turmaId: "4" },
  { id: "a7", name: "Gabriel Ramos", turmaId: "5" },
  { id: "a8", name: "Beatriz Almeida", turmaId: "6" },
];

/* ── Route ────────────────────────────────────────────────────── */

export const Route = createFileRoute("/ano-letivo")({
  head: () => ({
    meta: [
      { title: "Ano Letivo | Portal Escolar" },
      {
        name: "description",
        content: "Selecione uma turma e marque cada aluno como aprovado ou reprovado.",
      },
      { property: "og:title", content: "Ano Letivo | Portal Escolar" },
      {
        property: "og:description",
        content: "Selecione uma turma e marque cada aluno como aprovado ou reprovado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnoLetivoPage,
});

/* ── Component ────────────────────────────────────────────────── */

function AnoLetivoPage() {
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [destinoTurmaId, setDestinoTurmaId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedTurma = TURMAS.find((t) => t.id === selectedTurmaId) ?? null;

  const alunosDaTurma = useMemo(
    () => (selectedTurmaId ? ALUNOS.filter((a) => a.turmaId === selectedTurmaId) : []),
    [selectedTurmaId],
  );

  const marcados = alunosDaTurma.filter((a) => statusMap[a.id] != null).length;
  const aprovados = alunosDaTurma.filter((a) => statusMap[a.id] === "aprovado");
  const reprovados = alunosDaTurma.filter((a) => statusMap[a.id] === "reprovado");

  // Available destination turmas — all turmas EXCEPT the currently selected one
  const turmasDestino = TURMAS
    .filter((t) => t.id !== selectedTurmaId)
    .sort((a, b) => getSerieOrder(a.serie) - getSerieOrder(b.serie) || a.sufixo.localeCompare(b.sufixo));

  const destinoTurma = TURMAS.find((t) => t.id === destinoTurmaId) ?? null;

  function handleTurmaChange(turmaId: string) {
    setSelectedTurmaId(turmaId);
    setStatusMap({});
    setDestinoTurmaId("");
  }

  function handleSave() {
    if (marcados < alunosDaTurma.length) return;
    if (aprovados.length > 0 && !destinoTurmaId) {
      toast.error("Selecione a turma destino para os alunos aprovados.");
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!selectedTurma) return;

    if (aprovados.length > 0 && destinoTurma) {
      toast.success(
        `${aprovados.length} aluno(s) aprovado(s) movidos para ${buildTurmaLabel(destinoTurma.serie, destinoTurma.sufixo)}.`,
      );
    }

    if (reprovados.length > 0) {
      toast.info(
        `${reprovados.length} aluno(s) reprovado(s) permanecem em ${buildTurmaLabel(selectedTurma.serie, selectedTurma.sufixo)}.`,
      );
    }

    setConfirmOpen(false);
    setSelectedTurmaId("");
    setStatusMap({});
    setDestinoTurmaId("");
    toast.success("Resultado do ano salvo com sucesso!");
  }

  // Sort turmas for the origin selector
  const sortedTurmas = [...TURMAS].sort(
    (a, b) => getSerieOrder(a.serie) - getSerieOrder(b.serie) || a.sufixo.localeCompare(b.sufixo),
  );

  const allMarked = marcados === alunosDaTurma.length && alunosDaTurma.length > 0;
  const hasAprovados = aprovados.length > 0;

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Ano Letivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione a turma e marque cada aluno como aprovado ou reprovado.
        </p>

        {/* ── Step 1: Turma selector ──────────────────── */}
        <div className="mt-6">
          <label
            htmlFor="select-turma-origem"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Turma
          </label>
          <Select value={selectedTurmaId} onValueChange={handleTurmaChange}>
            <SelectTrigger id="select-turma-origem" className="w-full sm:w-80">
              <SelectValue placeholder="Selecione uma turma" />
            </SelectTrigger>
            <SelectContent>
              {sortedTurmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {buildTurmaLabel(t.serie, t.sufixo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Empty state ─────────────────────────────── */}
        {!selectedTurmaId && (
          <div className="mt-12 flex flex-col items-center gap-2 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent">
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Selecione uma turma acima para começar.
            </p>
          </div>
        )}

        {selectedTurmaId && alunosDaTurma.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum aluno encontrado nesta turma.
            </p>
          </div>
        )}

        {/* ── Step 2: Student list ────────────────────── */}
        {selectedTurmaId && alunosDaTurma.length > 0 && (
          <>
            <div className="mt-4 divide-y border-y">
              {alunosDaTurma.map((aluno) => {
                const current = statusMap[aluno.id] ?? null;
                return (
                  <div
                    key={aluno.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {aluno.name}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant={current === "aprovado" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 sm:flex-none"
                        aria-pressed={current === "aprovado"}
                        onClick={() =>
                          setStatusMap((s) => ({ ...s, [aluno.id]: "aprovado" }))
                        }
                      >
                        <Check className="size-4" />
                        Aprovado
                      </Button>
                      <Button
                        variant={current === "reprovado" ? "destructive" : "outline"}
                        size="sm"
                        className="flex-1 sm:flex-none"
                        aria-pressed={current === "reprovado"}
                        onClick={() =>
                          setStatusMap((s) => ({ ...s, [aluno.id]: "reprovado" }))
                        }
                      >
                        <X className="size-4" />
                        Reprovado
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Step 3: Destination turma (only when all marked & has aprovados) ── */}
            {allMarked && hasAprovados && (
              <div className="mt-6 rounded-md border border-border bg-accent/30 p-4">
                <label
                  htmlFor="select-turma-destino"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Turma destino para aprovados
                </label>
                <p className="mb-3 text-xs text-muted-foreground">
                  Escolha para qual turma os {aprovados.length} aluno(s) aprovado(s) serão movidos.
                </p>
                <Select value={destinoTurmaId} onValueChange={setDestinoTurmaId}>
                  <SelectTrigger id="select-turma-destino" className="w-full sm:w-80 bg-background">
                    <SelectValue placeholder="Selecione a turma destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmasDestino.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {buildTurmaLabel(t.serie, t.sufixo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Footer ──────────────────────────────── */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {marcados} de {alunosDaTurma.length} alunos marcados
              </p>
              <Button
                id="btn-salvar-ano"
                size="lg"
                className="h-11 w-full sm:w-auto"
                disabled={!allMarked || (hasAprovados && !destinoTurmaId)}
                onClick={handleSave}
              >
                Salvar resultado do ano
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Confirmation Dialog ────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar passagem de ano</DialogTitle>
            <DialogDescription>Revise o resultado antes de confirmar.</DialogDescription>
          </DialogHeader>

          {selectedTurma && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-accent/30 p-3">
                <p className="text-sm font-medium text-foreground">
                  {buildTurmaLabel(selectedTurma.serie, selectedTurma.sufixo)}
                </p>
                <div className="mt-2 flex gap-6 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-emerald-600">{aprovados.length}</strong> aprovado(s)
                  </span>
                  <span>
                    <strong className="text-destructive">{reprovados.length}</strong> reprovado(s)
                  </span>
                </div>
              </div>

              {aprovados.length > 0 && destinoTurma && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>{aprovados.length}</strong> aluno(s) serão movidos para{" "}
                    <strong>{buildTurmaLabel(destinoTurma.serie, destinoTurma.sufixo)}</strong>
                  </p>
                </div>
              )}

              {reprovados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {reprovados.length} aluno(s) reprovado(s) permanecem em{" "}
                  <strong>{buildTurmaLabel(selectedTurma.serie, selectedTurma.sufixo)}</strong>.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
