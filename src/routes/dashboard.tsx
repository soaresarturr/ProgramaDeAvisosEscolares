import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Megaphone, Send, Users } from "lucide-react";

import { requireAuth } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { PushPrompt } from "@/components/push-prompt";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import {
  buildTurmaLabelFull,
  useAlunos,
  useComunicados,
  useResponsaveis,
  useTurmas,
} from "@/lib/db";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuth,
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

const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

const headerButton = "h-10 px-4 sm:h-11 sm:px-6";

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isResponsavel = user?.role === "RESPONSAVEL";

  const { data: comunicados = [] } = useComunicados();
  const { data: turmas = [] } = useTurmas();
  const { data: alunos = [] } = useAlunos();
  const { data: responsaveis = [] } = useResponsaveis();

  const agora = Date.now();
  const summary = [
    { label: "Alunos", value: alunos.length, icon: Users },
    {
      label: "Enviados nos últimos 30 dias",
      value: comunicados.filter((c) => agora - new Date(c.criadoEm).getTime() < TRINTA_DIAS).length,
      icon: Send,
    },
    { label: "Responsáveis", value: responsaveis.length, icon: Megaphone },
  ];

  const meusFilhos = alunos.filter((a) => a.responsavelId === user?.id);

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">

        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Bom dia, {user?.name?.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isResponsavel
                ? "Acompanhe os comunicados das turmas dos seus filhos."
                : "Veja o que precisa da sua atenção."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isResponsavel && (
              <Button className={headerButton} onClick={() => navigate({ to: "/comunicados" })}>
                <Megaphone className="size-4" />
                Novo comunicado
              </Button>
            )}
          </div>
        </section>

        {isResponsavel && (
          <div className="mt-6">
            <PushPrompt />
          </div>
        )}

        {isResponsavel ? (
          <section className="mt-8" aria-labelledby="filhos-title">
            <h2 id="filhos-title" className="font-display text-lg font-semibold text-foreground">
              Meus filhos
            </h2>
            <div className="mt-3 divide-y border-y">
              {meusFilhos.map((f) => {
                const turma = turmas.find((t) => t.id === f.turmaId);
                return (
                  <div key={f.id} className="flex items-center justify-between gap-4 py-3">
                    <p className="min-w-0 truncate text-sm font-medium text-foreground">{f.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {turma ? buildTurmaLabelFull(turma) : ""}
                    </span>
                  </div>
                );
              })}
              {meusFilhos.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum filho vinculado ainda. Fale com a secretaria da escola.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section
            aria-label="Resumo"
            className="mt-8 grid overflow-hidden rounded-lg border bg-card sm:grid-cols-3"
          >
            {summary.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex min-h-24 items-center gap-4 p-5 ${
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
        )}

        <section className="mt-10" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-display text-lg font-semibold text-foreground">
            Últimos comunicados
          </h2>
          <div className="mt-3 divide-y border-y">
            {comunicados.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 py-4">
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{c.titulo}</p>
                <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                  {formatDate(c.criadoEm)}
                </time>
              </div>
            ))}
            {comunicados.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Nenhum comunicado ainda.</p>
            )}
          </div>
        </section>
      </div>

    </AdminShell>
  );
}
