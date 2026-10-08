import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { MOCK_DB, useAuth } from "@/contexts/auth";

export const Route = createFileRoute("/solicitacoes")({
  beforeLoad: requireAdmin,
  head: () => ({
    meta: [{ title: "Solicitações | Portal Escolar" }],
  }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const { aprovarProfessor, recusarProfessor } = useAuth();
  const pedidos = MOCK_DB.users.filter((u) => u.requestedProfessor);

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Solicitações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pessoas que pediram acesso como professor(a).
        </p>

        {pedidos.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Nenhuma solicitação no momento.
          </p>
        ) : (
          <div className="mt-6 divide-y border-y">
            {pedidos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Usuário: {p.username}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => recusarProfessor(p.id)}>
                    <X className="mr-1 size-3.5" />
                    Recusar
                  </Button>
                  <Button size="sm" onClick={() => aprovarProfessor(p.id)}>
                    <Check className="mr-1 size-3.5" />
                    Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
