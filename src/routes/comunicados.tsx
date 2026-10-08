import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

import { requireAuth } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_DB, useAuth } from "@/contexts/auth";
import { INITIAL_TURMAS, buildTurmaLabelFull } from "./turmas";

export const Route = createFileRoute("/comunicados")({
  beforeLoad: requireAuth,
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

const ESCOLA = "escola";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function ComunicadosPage() {
  const { user, criarComunicado } = useAuth();
  const canSend = user?.role === "ADMIN" || user?.role === "DEV" || user?.role === "PROFESSOR";

  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [destino, setDestino] = useState(ESCOLA);

  // Responsável só vê o que é da escola toda ou das turmas dos seus filhos
  const minhasTurmas = new Set(
    MOCK_DB.alunos.filter((a) => a.responsavelId === user?.id).map((a) => a.turmaId),
  );
  const visiveis = MOCK_DB.comunicados.filter(
    (c) => canSend || c.turmaId === null || minhasTurmas.has(c.turmaId),
  );
  const list =
    filter === "todos"
      ? visiveis
      : filter === ESCOLA
        ? visiveis.filter((c) => c.turmaId === null)
        : visiveis.filter((c) => c.turmaId === filter);

  const handleSend = () => {
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    const turma = INITIAL_TURMAS.find((t) => t.id === destino);
    criarComunicado(
      titulo,
      mensagem,
      turma ? turma.id : null,
      turma ? buildTurmaLabelFull(turma) : "Toda a escola",
    );
    setTitulo("");
    setMensagem("");
    setDestino(ESCOLA);
    setOpen(false);
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Comunicados</h1>
          {canSend && (
            <Button size="lg" className="h-11 w-full sm:w-auto" onClick={() => setOpen(true)}>
              <Megaphone className="size-4" />
              Novo comunicado
            </Button>
          )}
        </div>

        <div className="mt-6 max-w-xs">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filtrar por turma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os comunicados</SelectItem>
              <SelectItem value={ESCOLA}>Toda a escola</SelectItem>
              {INITIAL_TURMAS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {buildTurmaLabelFull(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 divide-y border-y">
          {list.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Para: {c.destinoLabel}</p>
                {c.mensagem && (
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{c.mensagem}</p>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                {formatDate(c.criadoEm)}
              </time>
            </div>
          ))}
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum comunicado por aqui.
            </p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo comunicado</DialogTitle>
            <DialogDescription>
              Os responsáveis escolhidos recebem uma notificação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="destino">Para quem?</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger id="destino">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ESCOLA}>Toda a escola</SelectItem>
                  {INITIAL_TURMAS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {buildTurmaLabelFull(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="flex min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend}>
              <Send className="mr-2 size-4" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
