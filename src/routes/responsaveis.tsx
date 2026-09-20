import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";

const responsaveis = [
  { name: "Maria da Silva", filhos: "João da Silva" },
  { name: "Carlos Oliveira", filhos: "Maria Oliveira" },
  { name: "Fernanda Santos", filhos: "Pedro Santos" },
  { name: "Roberto Costa", filhos: "Ana Costa" },
  { name: "Juliana Souza", filhos: "Lucas Souza" },
];

export const Route = createFileRoute("/responsaveis")({
  head: () => ({
    meta: [
      { title: "Responsáveis | Portal Escolar" },
      { name: "description", content: "Lista de responsáveis e seus filhos na escola." },
      { property: "og:title", content: "Responsáveis | Portal Escolar" },
      { property: "og:description", content: "Lista de responsáveis e seus filhos na escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResponsaveisPage,
});

function ResponsaveisPage() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Responsáveis</h1>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={() => toast.info("O cadastro de responsáveis chega na próxima etapa.")}
          >
            <Plus className="size-4" />
            Adicionar responsável
          </Button>
        </div>

        <div className="mt-6 divide-y border-y">
          {responsaveis.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-4 py-4">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{r.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">{r.filhos}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
