import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";

type Status = "aprovado" | "reprovado" | null;

const alunos = [
  { name: "João da Silva", turma: "7º Ano A" },
  { name: "Maria Oliveira", turma: "6º Ano A" },
  { name: "Pedro Santos", turma: "7º Ano B" },
  { name: "Ana Costa", turma: "8º Ano A" },
  { name: "Lucas Souza", turma: "6º Ano B" },
];

export const Route = createFileRoute("/ano-letivo")({
  head: () => ({
    meta: [
      { title: "Ano Letivo | Portal Escolar" },
      { name: "description", content: "Marque cada aluno como aprovado ou reprovado no ano." },
      { property: "og:title", content: "Ano Letivo | Portal Escolar" },
      {
        property: "og:description",
        content: "Marque cada aluno como aprovado ou reprovado no ano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnoLetivoPage,
});

function AnoLetivoPage() {
  const [status, setStatus] = useState<Record<string, Status>>({});

  const marcados = Object.values(status).filter(Boolean).length;

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Ano Letivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marque cada aluno como aprovado ou reprovado.
        </p>

        <div className="mt-6 divide-y border-y">
          {alunos.map((aluno) => {
            const current = status[aluno.name] ?? null;
            return (
              <div
                key={aluno.name}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{aluno.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{aluno.turma}</p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant={current === "aprovado" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 sm:flex-none"
                    aria-pressed={current === "aprovado"}
                    onClick={() => setStatus((s) => ({ ...s, [aluno.name]: "aprovado" }))}
                  >
                    <Check className="size-4" />
                    Aprovado
                  </Button>
                  <Button
                    variant={current === "reprovado" ? "destructive" : "outline"}
                    size="sm"
                    className="flex-1 sm:flex-none"
                    aria-pressed={current === "reprovado"}
                    onClick={() => setStatus((s) => ({ ...s, [aluno.name]: "reprovado" }))}
                  >
                    <X className="size-4" />
                    Reprovado
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {marcados} de {alunos.length} alunos marcados
          </p>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={marcados < alunos.length}
            onClick={() => toast.info("A confirmação da passagem de ano chega na próxima etapa.")}
          >
            Salvar resultado do ano
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
