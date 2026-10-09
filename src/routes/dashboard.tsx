import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Megaphone, Send, Users, UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";

import { formatCpf } from "@/lib/utils";
import { requireAuth } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { PushPrompt } from "@/components/push-prompt";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  buildTurmaLabelFull,
  dbErrorMessage,
  useAlunos,
  useComunicados,
  useCriarAluno,
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
  const { user, requestProfessorRole } = useAuth();
  const navigate = useNavigate();
  const isResponsavel = user?.role === "RESPONSAVEL";

  const { data: comunicados = [] } = useComunicados();
  const { data: turmas = [] } = useTurmas();
  const { data: alunos = [] } = useAlunos();
  const { data: responsaveis = [] } = useResponsaveis();
  const criarAluno = useCriarAluno();

  const [openAddFilho, setOpenAddFilho] = useState(false);
  const [nomeFilho, setNomeFilho] = useState("");
  const [cpfFilho, setCpfFilho] = useState("");
  const [turmaFilho, setTurmaFilho] = useState("");

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

  const handleAddFilho = () => {
    if (!user) return;
    if (!nomeFilho.trim() || !turmaFilho) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (cpfFilho.replace(/\D/g, "").length !== 11) {
      toast.error("Informe o CPF completo do aluno.");
      return;
    }
    criarAluno.mutate(
      { name: nomeFilho, cpf: cpfFilho, turmaId: turmaFilho, responsavelId: user.id },
      {
        onSuccess: () => {
          toast.success("Filho cadastrado! Você vai receber os comunicados da turma.");
          setNomeFilho("");
          setCpfFilho("");
          setTurmaFilho("");
          setOpenAddFilho(false);
        },
        onError: (e) =>
          toast.error(
            (e as { code?: string }).code === "23505"
              ? "Este CPF já está cadastrado. Se for seu filho, fale com a escola."
              : dbErrorMessage(e),
          ),
      },
    );
  };

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
            {isResponsavel ? (
              <>
                <Button variant="outline" className={headerButton} onClick={() => setOpenAddFilho(true)}>
                  <Plus className="size-4" />
                  Adicionar filho
                </Button>
                {user.requestedProfessor ? (
                  <Button disabled className={headerButton}>
                    Solicitação em análise
                  </Button>
                ) : (
                  <Button className={headerButton} onClick={() => void requestProfessorRole()}>
                    <UserPlus className="size-4" />
                    Sou Professor
                  </Button>
                )}
              </>
            ) : (
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
                  Adicione seu filho para receber os comunicados da turma dele.
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

      <Dialog open={openAddFilho} onOpenChange={setOpenAddFilho}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Filho</DialogTitle>
            <DialogDescription>
              Cadastre seu filho para receber os comunicados da turma dele.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nomeFilho">Nome Completo</Label>
              <Input
                id="nomeFilho"
                placeholder="Nome do aluno"
                value={nomeFilho}
                onChange={(e) => setNomeFilho(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpfFilho">CPF do Aluno</Label>
              <Input
                id="cpfFilho"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                value={cpfFilho}
                onChange={(e) => setCpfFilho(formatCpf(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="turmaFilho">Turma</Label>
              <select
                id="turmaFilho"
                value={turmaFilho}
                onChange={(e) => setTurmaFilho(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm"
              >
                <option value="" disabled>Selecione a turma...</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{buildTurmaLabelFull(t)}</option>
                ))}
              </select>
              {turmas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  A escola ainda não cadastrou turmas.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddFilho(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddFilho} disabled={criarAluno.isPending}>
              {criarAluno.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
