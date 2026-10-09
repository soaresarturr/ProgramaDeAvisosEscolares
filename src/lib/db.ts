// Acesso ao banco (Supabase) com cache do React Query.
// As regras de quem vê/altera o quê ficam no banco (RLS); aqui só buscamos e gravamos.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSupabase } from "./supabase";

/* ── Tipos ───────────────────────────────────────────────────── */

export interface Turma {
  id: string;
  /** Ex.: "J", "1", "2" */
  ano: string;
  /** Ex.: "A", "1A" */
  sufixo: string;
  anoLetivo: number;
  totalAlunos: number;
  codigoAcesso: string;
}

export interface Aluno {
  id: string;
  name: string;
  cpf: string;
  turmaId: string;
  responsavelId: string;
  responsavelNome: string | null;
}

export interface Responsavel {
  id: string;
  name: string;
  username: string;
  filhos: { id: string; name: string }[];
}

export interface Solicitacao {
  id: string;
  name: string;
  username: string;
}

export interface Comunicado {
  id: string;
  titulo: string;
  mensagem: string;
  /** null = toda a escola */
  turmaId: string | null;
  destinoLabel: string;
  criadoEm: string;
}

export interface Notificacao {
  id: string;
  titulo: string;
  lida: boolean;
  criadoEm: string;
}

/* ── Rótulos de turma ────────────────────────────────────────── */

/** Código curto, ex.: "J1A" */
export function buildTurmaCode(ano: string, sufixo: string): string {
  return `${ano}${sufixo}`;
}

export function buildTurmaLabel(t: Pick<Turma, "ano" | "sufixo">): string {
  return `Turma ${t.ano}${t.sufixo}`;
}

export function buildTurmaLabelFull(t: Pick<Turma, "ano" | "sufixo" | "anoLetivo">): string {
  return `Turma ${t.ano}${t.sufixo} · ${t.anoLetivo}`;
}

/* ── Erros ───────────────────────────────────────────────────── */

interface DbError {
  code?: string;
  message: string;
}

/** Traduz os erros mais comuns do Postgres para mensagens da escola. */
export function dbErrorMessage(error: unknown, fallback = "Não foi possível salvar. Tente novamente."): string {
  const e = error as DbError | null;
  if (e?.code === "23505") return "Já existe um cadastro com esses dados.";
  if (e?.code === "23503") return "Não dá para remover: ainda há registros ligados a este item.";
  if (e?.code === "42501") return "Você não tem permissão para fazer isso.";
  return fallback;
}

function unwrap<T>({ data, error }: { data: T | null; error: DbError | null }): T {
  if (error) throw error;
  return data as T;
}

/* ── Turmas ──────────────────────────────────────────────────── */

interface TurmaRow {
  id: string;
  ano: string;
  sufixo: string;
  ano_letivo: number;
  codigo_acesso: string;
  alunos: { count: number }[];
}

export function useTurmas() {
  return useQuery({
    queryKey: ["turmas"],
    queryFn: async (): Promise<Turma[]> => {
      const rows = unwrap<TurmaRow[]>(
        await getSupabase()
          .from("turmas")
          .select("id, ano, sufixo, ano_letivo, codigo_acesso, alunos(count)")
          .order("ano_letivo", { ascending: false })
          .order("ano")
          .order("sufixo"),
      );
      return rows.map((r) => ({
        id: r.id,
        ano: r.ano,
        sufixo: r.sufixo,
        anoLetivo: r.ano_letivo,
        codigoAcesso: r.codigo_acesso,
        totalAlunos: r.alunos[0]?.count ?? 0,
      }));
    },
  });
}

type TurmaInput = Pick<Turma, "ano" | "sufixo" | "anoLetivo">;

export function useSalvarTurma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...t }: TurmaInput & { id?: string }) => {
      const row = { ano: t.ano, sufixo: t.sufixo, ano_letivo: t.anoLetivo };
      const supabase = getSupabase();
      unwrap(
        id
          ? await supabase.from("turmas").update(row).eq("id", id)
          : await supabase.from("turmas").insert(row),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["turmas"] }),
  });
}

export function useRemoverTurma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await getSupabase().from("turmas").delete().eq("id", id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["turmas"] }),
  });
}

/* ── Alunos ──────────────────────────────────────────────────── */

interface AlunoRow {
  id: string;
  name: string;
  cpf: string;
  turma_id: string;
  responsavel_id: string;
  responsavel: { name: string } | null;
}

export function useAlunos() {
  return useQuery({
    queryKey: ["alunos"],
    queryFn: async (): Promise<Aluno[]> => {
      const rows = unwrap<AlunoRow[]>(
        await getSupabase()
          .from("alunos")
          .select("id, name, cpf, turma_id, responsavel_id, responsavel:profiles(name)")
          .order("name"),
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        cpf: r.cpf,
        turmaId: r.turma_id,
        responsavelId: r.responsavel_id,
        responsavelNome: r.responsavel?.name ?? null,
      }));
    },
  });
}

export function useCriarAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { name: string; cpf: string; turmaId: string; responsavelId: string }) => {
      unwrap(
        await getSupabase().from("alunos").insert({
          name: a.name.trim(),
          cpf: a.cpf.replace(/\D/g, ""),
          turma_id: a.turmaId,
          responsavel_id: a.responsavelId,
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alunos"] });
      void qc.invalidateQueries({ queryKey: ["turmas"] });
      void qc.invalidateQueries({ queryKey: ["responsaveis"] });
    },
  });
}

export function useRemoverAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await getSupabase().from("alunos").delete().eq("id", id));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alunos"] });
      void qc.invalidateQueries({ queryKey: ["turmas"] });
      void qc.invalidateQueries({ queryKey: ["responsaveis"] });
    },
  });
}

/** Passagem de ano: cada aluno vai para a turma escolhida (função do banco, só equipe). */
export function usePassarAno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movimentos: { alunoId: string; turmaId: string }[]) =>
      unwrap<number>(
        await getSupabase().rpc("passar_ano", {
          p_movimentos: movimentos.map((m) => ({ aluno_id: m.alunoId, turma_id: m.turmaId })),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alunos"] });
      void qc.invalidateQueries({ queryKey: ["turmas"] });
    },
  });
}

/** Ordem dos anos: J (Jardim) → 1 → 2 → 3 ... Devolve null se não houver próximo. */
export function proximoAno(ano: string): string | null {
  const a = ano.trim().toUpperCase();
  if (a === "J") return "1";
  const n = Number(a);
  return Number.isInteger(n) && n >= 1 ? String(n + 1) : null;
}

/* ── Responsáveis e solicitações de professor ───────────────── */

export function useResponsaveis() {
  return useQuery({
    queryKey: ["responsaveis"],
    queryFn: async (): Promise<Responsavel[]> =>
      unwrap<Responsavel[]>(
        await getSupabase()
          .from("profiles")
          .select("id, name, username, filhos:alunos(id, name)")
          .eq("role", "RESPONSAVEL")
          .order("name"),
      ),
  });
}

export function useSolicitacoes(enabled = true) {
  return useQuery({
    queryKey: ["solicitacoes"],
    enabled,
    queryFn: async (): Promise<Solicitacao[]> =>
      unwrap<Solicitacao[]>(
        await getSupabase()
          .from("profiles")
          .select("id, name, username")
          .eq("requested_professor", true)
          .order("name"),
      ),
  });
}

export function useDecidirSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, aprovar }: { userId: string; aprovar: boolean }) => {
      unwrap(
        await getSupabase().rpc(aprovar ? "aprovar_professor" : "recusar_professor", { p_user: userId }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      void qc.invalidateQueries({ queryKey: ["responsaveis"] });
    },
  });
}

/* ── Comunicados ─────────────────────────────────────────────── */

interface ComunicadoRow {
  id: string;
  titulo: string;
  mensagem: string;
  turma_id: string | null;
  criado_em: string;
  turma: { ano: string; sufixo: string; ano_letivo: number } | null;
}

export function useComunicados() {
  return useQuery({
    queryKey: ["comunicados"],
    queryFn: async (): Promise<Comunicado[]> => {
      const rows = unwrap<ComunicadoRow[]>(
        await getSupabase()
          .from("comunicados")
          .select("id, titulo, mensagem, turma_id, criado_em, turma:turmas(ano, sufixo, ano_letivo)")
          .order("criado_em", { ascending: false }),
      );
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        mensagem: r.mensagem,
        turmaId: r.turma_id,
        criadoEm: r.criado_em,
        destinoLabel: r.turma
          ? buildTurmaLabelFull({ ano: r.turma.ano, sufixo: r.turma.sufixo, anoLetivo: r.turma.ano_letivo })
          : "Toda a escola",
      }));
    },
  });
}

/** Cria o comunicado e as notificações; devolve quantos responsáveis foram avisados. */
export function useCriarComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { titulo: string; mensagem: string; turmaId: string | null }) =>
      unwrap<number>(
        await getSupabase().rpc("criar_comunicado", {
          p_titulo: c.titulo,
          p_mensagem: c.mensagem,
          p_turma_id: c.turmaId,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comunicados"] }),
  });
}

/* ── Notificações (com tempo real) ──────────────────────────── */

interface NotificacaoRow {
  id: string;
  lida: boolean;
  criado_em: string;
  comunicado: { titulo: string } | null;
}

export function useNotificacoes(userId: string | undefined) {
  const qc = useQueryClient();

  // Novas notificações chegam pelo Realtime do Supabase, sem recarregar a página.
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
          void qc.invalidateQueries({ queryKey: ["comunicados"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return useQuery({
    queryKey: ["notificacoes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Notificacao[]> => {
      const rows = unwrap<NotificacaoRow[]>(
        await getSupabase()
          .from("notificacoes")
          .select("id, lida, criado_em, comunicado:comunicados(titulo)")
          .order("criado_em", { ascending: false })
          .limit(30),
      );
      return rows.map((r) => ({
        id: r.id,
        lida: r.lida,
        criadoEm: r.criado_em,
        titulo: r.comunicado?.titulo ?? "Comunicado",
      }));
    },
  });
}

export function useMarcarNotificacoesLidas(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      unwrap(
        await getSupabase().from("notificacoes").update({ lida: true }).eq("user_id", userId).eq("lida", false),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", userId] }),
  });
}
