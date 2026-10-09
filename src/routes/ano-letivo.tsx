import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { requireStaff } from "@/lib/session";
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
import {
  type Turma,
  buildTurmaLabelFull,
  dbErrorMessage,
  proximoAno,
  useAlunos,
  usePassarAno,
  useTurmas,
} from "@/lib/db";

/* ── Types ────────────────────────────────────────────────────── */

type Status = "aprovado" | "reprovado";

interface Resultado {
  status: Status;
  destinoId: string;
}

/* ── Route ────────────────────────────────────────────────────── */

export const Route = createFileRoute("/ano-letivo")({
  beforeLoad: requireStaff,
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
  const { data: turmas = [] } = useTurmas();
  const { data: alunos = [] } = useAlunos();
  const passarAno = usePassarAno();

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedTurma = turmas.find((t) => t.id === selectedTurmaId) ?? null;

  const alunosDaTurma = useMemo(
    () => (selectedTurmaId ? alunos.filter((a) => a.turmaId === selectedTurmaId) : []),
    [selectedTurmaId, alunos],
  );

  /**
   * Turmas possíveis para o aluno:
   *  - reprovado → mesmo ano (J, 1, 2...), qualquer sufixo
   *  - aprovado  → ano seguinte (J → 1 → 2 ...), qualquer sufixo
   * Só do ano letivo atual da turma em diante.
   */
  const opcoesDestino = (status: Status): Turma[] => {
    if (!selectedTurma) return [];
    const anoAlvo = status === "aprovado" ? proximoAno(selectedTurma.ano) : selectedTurma.ano;
    return turmas
      .filter((t) => t.ano === anoAlvo && t.anoLetivo >= selectedTurma.anoLetivo)
      .sort((a, b) => b.anoLetivo - a.anoLetivo || a.sufixo.localeCompare(b.sufixo));
  };

  function marcar(alunoId: string, status: Status) {
    const opcoes = opcoesDestino(status);
    // Se só existe uma turma possível, já deixa escolhida
    setResultados((r) => ({
      ...r,
      [alunoId]: { status, destinoId: opcoes.length === 1 ? opcoes[0]!.id : "" },
    }));
  }

  function escolherDestino(alunoId: string, destinoId: string) {
    setResultados((r) => {
      const atual = r[alunoId];
      return atual ? { ...r, [alunoId]: { ...atual, destinoId } } : r;
    });
  }

  function handleTurmaChange(turmaId: string) {
    setSelectedTurmaId(turmaId);
    setResultados({});
  }

  const prontos = alunosDaTurma.filter((a) => resultados[a.id]?.destinoId).length;
  const aprovados = alunosDaTurma.filter((a) => resultados[a.id]?.status === "aprovado").length;
  const reprovados = alunosDaTurma.filter((a) => resultados[a.id]?.status === "reprovado").length;
  const tudoPronto = alunosDaTurma.length > 0 && prontos === alunosDaTurma.length;

  const nomeTurma = (id: string) => {
    const t = turmas.find((x) => x.id === id);
    return t ? buildTurmaLabelFull(t) : "";
  };

  function handleConfirm() {
    const movimentos = alunosDaTurma
      .map((a) => ({ alunoId: a.id, turmaId: resultados[a.id]?.destinoId ?? "" }))
      // Quem fica na mesma turma não precisa ser gravado
      .filter((m) => m.turmaId && m.turmaId !== selectedTurmaId);

    const finish = () => {
      setConfirmOpen(false);
      setSelectedTurmaId("");
      setResultados({});
      toast.success("Resultado do ano salvo com sucesso!");
    };

    if (movimentos.length === 0) {
      finish();
      return;
    }
    passarAno.mutate(movimentos, {
      onSuccess: finish,
      onError: (e) => toast.error(dbErrorMessage(e)),
    });
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Ano Letivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione a turma, marque cada aluno e escolha a turma do próximo ano.
        </p>

        <div className="mt-6 max-w-xs">
          <label htmlFor="select-turma" className="mb-2 block text-sm font-medium text-foreground">
            Turma
          </label>
          <Select value={selectedTurmaId} onValueChange={handleTurmaChange}>
            <SelectTrigger id="select-turma">
              <SelectValue placeholder="Selecione a turma" />
            </SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {buildTurmaLabelFull(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {turmas.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
          )}
        </div>

        {selectedTurmaId && alunosDaTurma.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Esta turma não tem alunos.</p>
        )}

        {selectedTurmaId && alunosDaTurma.length > 0 && (
          <>
            <div className="mt-4 divide-y border-y">
              {alunosDaTurma.map((aluno) => {
                const r = resultados[aluno.id];
                const opcoes = r ? opcoesDestino(r.status) : [];
                return (
                  <div key={aluno.id} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{aluno.name}</p>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant={r?.status === "aprovado" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 sm:flex-none"
                          aria-pressed={r?.status === "aprovado"}
                          onClick={() => marcar(aluno.id, "aprovado")}
                        >
                          <Check className="size-4" />
                          Aprovado
                        </Button>
                        <Button
                          variant={r?.status === "reprovado" ? "destructive" : "outline"}
                          size="sm"
                          className="flex-1 sm:flex-none"
                          aria-pressed={r?.status === "reprovado"}
                          onClick={() => marcar(aluno.id, "reprovado")}
                        >
                          <X className="size-4" />
                          Reprovado
                        </Button>
                      </div>
                    </div>

                    {r && (
                      <div className="sm:ml-auto sm:w-72">
                        {opcoes.length === 0 ? (
                          <p className="text-xs text-destructive">
                            {r.status === "aprovado"
                              ? "Não há turma do próximo ano cadastrada. Crie em Turmas."
                              : "Não há turma deste ano cadastrada."}
                          </p>
                        ) : (
                          <Select value={r.destinoId} onValueChange={(v) => escolherDestino(aluno.id, v)}>
                            <SelectTrigger aria-label={`Turma de ${aluno.name} no próximo ano`}>
                              <SelectValue placeholder="Vai para qual turma?" />
                            </SelectTrigger>
                            <SelectContent>
                              {opcoes.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {buildTurmaLabelFull(t)}
                                  {t.id === selectedTurmaId ? " (atual)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {prontos} de {alunosDaTurma.length} alunos prontos
              </p>
              <Button
                id="btn-salvar-ano"
                className="h-10 self-start px-4 sm:h-11 sm:self-auto sm:px-6"
                disabled={!tudoPronto}
                onClick={() => setConfirmOpen(true)}
              >
                Salvar resultado do ano
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar passagem de ano</DialogTitle>
            <DialogDescription>Revise o resultado antes de confirmar.</DialogDescription>
          </DialogHeader>

          {selectedTurma && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-accent/30 p-3">
                <p className="text-sm font-medium text-foreground">{buildTurmaLabelFull(selectedTurma)}</p>
                <div className="mt-2 flex gap-6 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-emerald-600">{aprovados}</strong> aprovado(s)
                  </span>
                  <span>
                    <strong className="text-destructive">{reprovados}</strong> reprovado(s)
                  </span>
                </div>
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {alunosDaTurma.map((a) => (
                  <li key={a.id}>
                    <strong className="text-foreground">{a.name}</strong> →{" "}
                    {nomeTurma(resultados[a.id]?.destinoId ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleConfirm} disabled={passarAno.isPending}>
              {passarAno.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
