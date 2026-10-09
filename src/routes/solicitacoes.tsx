import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { dbErrorMessage, useDecidirSolicitacao, useSolicitacoes } from "@/lib/db";

export const Route = createFileRoute("/solicitacoes")({
  beforeLoad: requireAdmin,
  head: () => ({
    meta: [{ title: "Solicitações | Portal Escolar" }],
  }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const { data: pedidos = [], isLoading } = useSolicitacoes();
  const decidir = useDecidirSolicitacao();

  const handle = (userId: string, name: string, aprovar: boolean) =>
    decidir.mutate(
      { userId, aprovar },
      {
        onSuccess: () =>
          aprovar ? toast.success(`${name} agora é professor(a).`) : toast.info("Solicitação recusada."),
        onError: (e) => toast.error(dbErrorMessage(e)),
      },
    );

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Solicitações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pessoas que pediram acesso como professor(a).
        </p>

        {isLoading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : pedidos.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Nenhuma solicitação no momento.
          </p>
        ) : (
          <div className="mt-6 divide-y border-y">
            {pedidos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Usuário: {p.username}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={decidir.isPending}
                    onClick={() => handle(p.id, p.name, false)}
                  >
                    <X className="size-3.5" />
                    Recusar
                  </Button>
                  <Button size="sm" disabled={decidir.isPending} onClick={() => handle(p.id, p.name, true)}>
                    <Check className="size-3.5" />
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
