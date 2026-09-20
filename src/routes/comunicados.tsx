import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const announcements = [
  { title: "Reunião de pais", date: "18 de setembro", to: "Todas as turmas" },
  { title: "Passeio do 7º Ano", date: "16 de setembro", to: "7º Ano A" },
  { title: "Lembrete sobre o feriado", date: "12 de setembro", to: "Todas as turmas" },
  { title: "Entrega de boletins", date: "5 de setembro", to: "6º Ano A" },
  { title: "Feira de ciências", date: "28 de agosto", to: "8º Ano A" },
  { title: "Uniforme novo", date: "20 de agosto", to: "Todas as turmas" },
  { title: "Prova de recuperação", date: "12 de agosto", to: "7º Ano B" },
  { title: "Início do 2º semestre", date: "1 de agosto", to: "Todas as turmas" },
];

const turmas = ["Todas as turmas", "6º Ano A", "6º Ano B", "7º Ano A", "7º Ano B", "8º Ano A"];

export const Route = createFileRoute("/comunicados")({
  head: () => ({
    meta: [
      { title: "Comunicados | Portal Escolar" },
      { name: "description", content: "Todos os comunicados enviados aos responsáveis." },
      { property: "og:title", content: "Comunicados | Portal Escolar" },
      { property: "og:description", content: "Todos os comunicados enviados aos responsáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComunicadosPage,
});

function ComunicadosPage() {
  const [filter, setFilter] = useState("todas");

  const list =
    filter === "todas" ? announcements : announcements.filter((a) => a.to === filter);

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Comunicados</h1>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={() => toast.info("A tela de novo comunicado será criada na próxima etapa.")}
          >
            <Megaphone className="size-4" />
            Novo comunicado
          </Button>
        </div>

        <div className="mt-6 max-w-xs">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filtrar por turma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os comunicados</SelectItem>
              {turmas.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 divide-y border-y">
          {list.map((a) => (
            <div key={a.title} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Para: {a.to}</p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">{a.date}</time>
            </div>
          ))}
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum comunicado para essa turma.
            </p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
