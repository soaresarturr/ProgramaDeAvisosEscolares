import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogs } from "@/lib/db";

export const Route = createFileRoute("/logs")({
  beforeLoad: requireAdmin,
  head: () => ({
    meta: [{ title: "Registro de atividades | Portal Escolar" }],
  }),
  component: LogsPage,
});

const PASSO = 100;

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogsPage() {
  const [limite, setLimite] = useState(PASSO);
  const [busca, setBusca] = useState("");
  const { data: logs = [], isLoading, isFetching } = useLogs(limite);

  const termo = busca.trim().toLowerCase();
  const lista = termo
    ? logs.filter((l) =>
        [l.acao, l.detalhes ?? "", l.atorNome ?? ""].some((campo) => campo.toLowerCase().includes(termo)),
      )
    : logs;

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Registro de atividades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem fez o quê no sistema: comunicados, turmas, alunos e usuários.
        </p>

        <div className="mt-6 max-w-sm">
          <Input
            placeholder="Buscar por pessoa, ação ou nome"
            aria-label="Buscar no registro"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="mt-4 divide-y border-y">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && lista.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          )}
          {lista.map((l) => (
            <div key={l.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
              <time className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-32 sm:pt-0.5">
                {formatDataHora(l.criadoEm)}
              </time>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{l.acao}</span>
                  {l.detalhes && <span className="text-foreground/80"> — {l.detalhes}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">por {l.atorNome ?? "Sistema"}</p>
              </div>
            </div>
          ))}
        </div>

        {logs.length >= limite && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setLimite((n) => n + PASSO)}>
              {isFetching ? "Carregando..." : "Mostrar mais antigos"}
            </Button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
