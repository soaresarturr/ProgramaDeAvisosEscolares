import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";

const turmas = [
  { name: "6º Ano A", alunos: "28 alunos" },
  { name: "6º Ano B", alunos: "27 alunos" },
  { name: "7º Ano A", alunos: "30 alunos" },
  { name: "7º Ano B", alunos: "29 alunos" },
  { name: "8º Ano A", alunos: "26 alunos" },
];

export const Route = createFileRoute("/turmas")({
  head: () => ({
    meta: [
      { title: "Turmas | Portal Escolar" },
      { name: "description", content: "Turmas da escola e quantidade de alunos." },
      { property: "og:title", content: "Turmas | Portal Escolar" },
      { property: "og:description", content: "Turmas da escola e quantidade de alunos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TurmasPage,
});

function TurmasPage() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Turmas</h1>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={() => toast.info("O cadastro de turmas chega na próxima etapa.")}
          >
            <Plus className="size-4" />
            Adicionar turma
          </Button>
        </div>

        <div className="mt-6 divide-y border-y">
          {turmas.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-4 py-4">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{t.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">{t.alunos}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
