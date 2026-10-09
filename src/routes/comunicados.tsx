import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Megaphone, Send } from "lucide-react";
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
import { useAuth } from "@/contexts/auth";
import {
  anoLabel,
  buildTurmaLabelFull,
  compararAnos,
  dbErrorMessage,
  useComunicados,
  useCriarComunicado,
  useTurmas,
} from "@/lib/db";

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
const PRIVADO = "privado";
const TODOS_ANOS = "todos";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function ComunicadosPage() {
  const { user } = useAuth();
  const { data: comunicados = [], isLoading } = useComunicados();
  const { data: turmas = [] } = useTurmas();
  const canSend = user?.role === "ADMIN" || user?.role === "DEV" || user?.role === "PROFESSOR";

  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);

  // O banco (RLS) já entrega ao responsável só o que é dele
  const list =
    filter === "todos"
      ? comunicados
      : filter === ESCOLA
        ? comunicados.filter((c) => !c.privado && c.turmaId === null)
        : filter === PRIVADO
          ? comunicados.filter((c) => c.privado)
          : comunicados.filter((c) => c.turmaId === filter);

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground">Comunicados</h1>
          {canSend && (
            <Button className="h-10 self-start px-4 sm:h-11 sm:self-auto sm:px-6" onClick={() => setOpen(true)}>
              <Megaphone className="size-4" />
              Novo comunicado
            </Button>
          )}
        </div>

        {canSend && (
          <div className="mt-6 max-w-xs">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger aria-label="Filtrar comunicados">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os comunicados</SelectItem>
                <SelectItem value={ESCOLA}>Toda a escola</SelectItem>
                <SelectItem value={PRIVADO}>Mensagens privadas</SelectItem>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {buildTurmaLabelFull(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-6 divide-y border-y">
          {list.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                  {c.privado && <Lock className="size-3" aria-label="Mensagem privada" />}
                  <span>
                    {c.privado ? "Privada para" : "Para"}: {c.destinoLabel}
                  </span>
                  {c.autorNome && <span>· Enviado por {c.autorNome}</span>}
                </p>
                {c.mensagem && (
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{c.mensagem}</p>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                {formatDate(c.criadoEm)}
              </time>
            </div>
          ))}
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          )}
          {!isLoading && list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum comunicado por aqui.
            </p>
          )}
        </div>
      </div>

      {open && <NovoComunicadoDialog onClose={() => setOpen(false)} />}
    </AdminShell>
  );
}

/* ── Novo comunicado: escola inteira ou uma turma (Ano → Turma) ── */

function NovoComunicadoDialog({ onClose }: { onClose: () => void }) {
  const { data: turmas = [] } = useTurmas();
  const criarComunicado = useCriarComunicado();

  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ano, setAno] = useState(TODOS_ANOS);
  const [turmaId, setTurmaId] = useState("");

  // Só aparecem os anos que já têm turma criada
  const anos = useMemo(() => [...new Set(turmas.map((t) => t.ano))].sort(compararAnos), [turmas]);

  const turmasDoAno = useMemo(
    () =>
      turmas
        .filter((t) => t.ano === ano)
        .sort((x, y) => y.anoLetivo - x.anoLetivo || x.sufixo.localeCompare(y.sufixo)),
    [turmas, ano],
  );
  // Se o mesmo ano tem turmas de mais de um ano letivo, mostramos o ano letivo junto
  const variosAnosLetivos = new Set(turmasDoAno.map((t) => t.anoLetivo)).size > 1;

  const escolherAno = (valor: string) => {
    setAno(valor);
    const doAno = turmas.filter((t) => t.ano === valor);
    // Ano com uma turma só: já deixa escolhida
    setTurmaId(doAno.length === 1 ? doAno[0]!.id : "");
  };

  const handleSend = () => {
    if (ano !== TODOS_ANOS && !turmaId) {
      toast.error("Escolha a turma.");
      return;
    }
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    criarComunicado.mutate(
      { titulo, mensagem, turmaId: ano === TODOS_ANOS ? null : turmaId },
      {
        onSuccess: (avisados) => {
          toast.success(
            avisados === 0
              ? "Comunicado salvo. Ainda não há responsáveis para avisar."
              : `Comunicado enviado! ${avisados} ${avisados === 1 ? "responsável avisado" : "responsáveis avisados"}.`,
          );
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
          <DialogTitle>Novo comunicado</DialogTitle>
          <DialogDescription>Os responsáveis escolhidos recebem uma notificação.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="destino-ano">Ano</Label>
              <select
                id="destino-ano"
                value={ano}
                onChange={(e) => escolherAno(e.target.value)}
                className={selectClass}
              >
                <option value={TODOS_ANOS}>Todos (escola inteira)</option>
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {anoLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="destino-turma">Turma</Label>
              <select
                id="destino-turma"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                disabled={ano === TODOS_ANOS}
                className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {ano === TODOS_ANOS ? (
                  <option value="">Todas</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Escolha...
                    </option>
                    {turmasDoAno.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.sufixo}
                        {variosAnosLetivos ? ` · ${t.anoLetivo}` : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
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
              className="flex min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={criarComunicado.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={criarComunicado.isPending}>
            <Send className="size-4" />
            {criarComunicado.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
