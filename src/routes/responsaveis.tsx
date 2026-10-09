import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { requireStaff } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Responsavel, dbErrorMessage, useCriarComunicado, useResponsaveis } from "@/lib/db";

export const Route = createFileRoute("/responsaveis")({
  beforeLoad: requireStaff,
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
  const { data: parents = [], isLoading } = useResponsaveis();
  const [mensagemPara, setMensagemPara] = useState<Responsavel | null>(null);

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground">Responsáveis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {parents.length} {parents.length === 1 ? "responsável cadastrado" : "responsáveis cadastrados"}
        </p>

        {isLoading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : parents.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Nenhum responsável cadastrado ainda.</p>
        ) : (
          <div className="mt-6 divide-y border-y">
            {parents.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.filhos.length > 0
                      ? `Filhos: ${r.filhos.map((f) => f.name).join(", ")}`
                      : "Nenhum filho vinculado"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={r.filhos.length === 0}
                  title={r.filhos.length === 0 ? "Vincule um filho para poder enviar mensagem" : undefined}
                  onClick={() => setMensagemPara(r)}
                >
                  <MessageSquare className="size-3.5" />
                  <span className="hidden sm:inline">Enviar mensagem</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {mensagemPara && (
        <MensagemDialog responsavel={mensagemPara} onClose={() => setMensagemPara(null)} />
      )}
    </AdminShell>
  );
}

/* ── Mensagem privada sobre os filhos marcados deste responsável ── */

function MensagemDialog({ responsavel, onClose }: { responsavel: Responsavel; onClose: () => void }) {
  const criarComunicado = useCriarComunicado();
  // Com um filho só, já vem marcado; com vários, a pessoa escolhe
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(responsavel.filhos.length === 1 ? responsavel.filhos.map((f) => f.id) : []),
  );
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");

  const alternar = (id: string, marcado: boolean) =>
    setMarcados((s) => {
      const novo = new Set(s);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  const enviar = () => {
    if (marcados.size === 0) {
      toast.error("Marque sobre qual filho é a mensagem.");
      return;
    }
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    criarComunicado.mutate(
      { titulo, mensagem, turmaId: null, alunoIds: [...marcados] },
      {
        onSuccess: () => {
          toast.success(`Mensagem enviada para ${responsavel.name}.`);
          onClose();
        },
        onError: (e) => toast.error(dbErrorMessage(e, "Não foi possível enviar. Tente novamente.")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !criarComunicado.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mensagem para {responsavel.name}</DialogTitle>
          <DialogDescription>Mensagem privada: só este responsável recebe e vê.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Sobre qual filho?</Label>
            <div className="divide-y rounded-md border">
              {responsavel.filhos.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/50"
                >
                  <Checkbox
                    checked={marcados.has(f.id)}
                    onCheckedChange={(v) => alternar(f.id, v === true)}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msg-titulo">Título</Label>
            <Input id="msg-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msg-texto">Mensagem</Label>
            <textarea
              id="msg-texto"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="flex min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={criarComunicado.isPending}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={criarComunicado.isPending}>
            <Send className="size-4" />
            {criarComunicado.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
