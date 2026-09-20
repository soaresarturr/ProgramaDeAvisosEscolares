import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";

const alunos = [
  { name: "João da Silva", turma: "7º Ano A" },
  { name: "Maria Oliveira", turma: "6º Ano A" },
  { name: "Pedro Santos", turma: "7º Ano B" },
  { name: "Ana Costa", turma: "8º Ano A" },
  { name: "Lucas Souza", turma: "6º Ano B" },
];

export const Route = createFileRoute("/alunos")({
  head: () => ({
    meta: [
      { title: "Alunos | Portal Escolar" },
      { name: "description", content: "Lista de alunos cadastrados na escola." },
      { property: "og:title", content: "Alunos | Portal Escolar" },
      { property: "og:description", content: "Lista de alunos cadastrados na escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlunosPage,
});

function AlunosPage() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Alunos</h1>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={() => toast.info("O cadastro de alunos chega na próxima etapa.")}
          >
            <Plus className="size-4" />
            Adicionar aluno
          </Button>
        </div>

        <div className="mt-6 divide-y border-y">
          {alunos.map((aluno) => (
            <div key={aluno.name} className="flex items-center justify-between gap-4 py-4">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{aluno.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                {aluno.turma}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
