import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";


const summary = [
  { label: "Alunos", value: "147", icon: Users },
  { label: "Enviados nos últimos 30 dias", value: "8", icon: Send },
  { label: "Ainda não lidos", value: "5", icon: Megaphone },
];

const recentAnnouncements = [
  { title: "Reunião de pais", date: "18 de setembro" },
  { title: "Passeio do 7º Ano", date: "16 de setembro" },
  { title: "Lembrete sobre o feriado", date: "12 de setembro" },
];

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Início | Portal Escolar" },
      {
        name: "description",
        content: "Resumo administrativo do Portal Escolar.",
      },
      { property: "og:title", content: "Início | Portal Escolar" },
      {
        property: "og:description",
        content: "Resumo administrativo do Portal Escolar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">

        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Bom dia
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Veja o que precisa da sua atenção.</p>
          </div>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={() => toast.info("A tela de novo comunicado será criada na próxima etapa.")}
          >
            <Megaphone className="size-4" />
            Novo comunicado
          </Button>
        </section>

        <section
          aria-label="Resumo"
          className="mt-8 grid overflow-hidden rounded-lg border bg-card sm:grid-cols-3"
        >
          {summary.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex min-h-28 items-center gap-4 p-5 ${
                  index > 0 ? "border-t sm:border-l sm:border-t-0" : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{item.value}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.label}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-10" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-display text-lg font-semibold text-foreground">
            Últimos comunicados
          </h2>
          <div className="mt-3 divide-y border-y">
            {recentAnnouncements.map((announcement) => (
              <div
                key={announcement.title}
                className="flex items-center justify-between gap-4 py-4"
              >
                <p className="min-w-0 truncate text-sm font-medium text-foreground">
                  {announcement.title}
                </p>
                <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                  {announcement.date}
                </time>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}