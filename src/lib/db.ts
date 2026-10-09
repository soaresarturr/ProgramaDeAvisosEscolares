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
  /** null = toda a escola (ou mensagem privada) */
  turmaId: string | null;
  /** Mensagem só para alunos escolhidos */
  privado: boolean;
  /** Alunos da mensagem privada (o responsável só recebe os nomes dos próprios filhos) */
  alunosNomes: string[];
  destinoLabel: string;
  autorNome: string | null;
  criadoEm: string;
}

export interface LogEntry {
  id: number;
  criadoEm: string;
  atorNome: string | null;
  acao: string;
  detalhes: string | null;
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
  alunos: { count: number }[];
}

export function useTurmas() {
  return useQuery({
    queryKey: ["turmas"],
    queryFn: async (): Promise<Turma[]> => {
      const rows = unwrap<TurmaRow[]>(
        await getSupabase()
          .from("turmas")
          .select("id, ano, sufixo, ano_letivo, alunos(count)")
          .order("ano_letivo", { ascending: false })
          .order("ano")
          .order("sufixo"),
      );
      return rows.map((r) => ({
        id: r.id,
        ano: r.ano,
        sufixo: r.sufixo,
        anoLetivo: r.ano_letivo,
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

/** Nome do ano para a tela: "J" → "Jardim", "1" → "1º ano". */
export function anoLabel(ano: string): string {
  const a = ano.trim().toUpperCase();
  return a === "J" ? "Jardim" : /^\d+$/.test(a) ? `${a}º ano` : a;
}

/** Ordena anos na sequência da escola: J, 1, 2, 3... */
export function compararAnos(a: string, b: string): number {
  const peso = (x: string) => (x.toUpperCase() === "J" ? 0 : Number(x) || 999);
  return peso(a) - peso(b) || a.localeCompare(b);
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

/* ── Usuários (contas criadas pela administração) ────────────── */

export type Papel = "ADMIN" | "DEV" | "PROFESSOR" | "RESPONSAVEL";

export interface Usuario {
  id: string;
  name: string;
  username: string;
  cpf: string | null;
  role: Papel;
}

export interface Credenciais {
  login: string;
  senha: string;
}

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async (): Promise<Usuario[]> =>
      unwrap<Usuario[]>(
        await getSupabase().from("profiles").select("id, name, username, cpf, role").order("name"),
      ),
  });
}

/** Chama a Edge Function "gerenciar-usuarios" e devolve a mensagem de erro dela, se houver. */
async function gerenciarUsuarios<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("gerenciar-usuarios", { body });
  if (error) {
    let mensagem = "Não foi possível concluir. Tente novamente.";
    try {
      const resposta = (error as { context?: Response }).context;
      const corpo = (await resposta?.json()) as { erro?: string } | undefined;
      if (corpo?.erro) mensagem = corpo.erro;
    } catch {
      // resposta sem JSON: fica a mensagem genérica
    }
    throw new Error(mensagem);
  }
  return data as T;
}

/** Remove a conta; o banco apaga junto os filhos, notificações e aparelhos de push. */
export function useRemoverUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => gerenciarUsuarios<{ ok: true }>({ acao: "remover", userId }),
    onSuccess: () => {
      for (const key of ["usuarios", "responsaveis", "alunos", "turmas"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: { nome: string; cpf: string; papel: Papel }) =>
      gerenciarUsuarios<Credenciais & { userId: string }>({ acao: "criar", ...u }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["usuarios"] });
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
  privado: boolean;
  autor_nome: string | null;
  turma: { ano: string; sufixo: string; ano_letivo: number } | null;
  alvos: { aluno: { name: string } | null }[];
}

export function useComunicados() {
  return useQuery({
    queryKey: ["comunicados"],
    queryFn: async (): Promise<Comunicado[]> => {
      const rows = unwrap<ComunicadoRow[]>(
        await getSupabase()
          .from("comunicados")
          .select(
            "id, titulo, mensagem, turma_id, criado_em, privado, autor_nome, " +
              "turma:turmas(ano, sufixo, ano_letivo), alvos:comunicado_alunos(aluno:alunos(name))",
          )
          .order("criado_em", { ascending: false }),
      );
      return rows.map((r) => {
        const alunosNomes = r.alvos.flatMap((a) => (a.aluno ? [a.aluno.name] : [])).sort();
        return {
          id: r.id,
          titulo: r.titulo,
          mensagem: r.mensagem,
          turmaId: r.turma_id,
          privado: r.privado,
          alunosNomes,
          autorNome: r.autor_nome,
          criadoEm: r.criado_em,
          destinoLabel: r.privado
            ? alunosNomes.join(", ") || "Alunos escolhidos"
            : r.turma
              ? buildTurmaLabelFull({ ano: r.turma.ano, sufixo: r.turma.sufixo, anoLetivo: r.turma.ano_letivo })
              : "Toda a escola",
        };
      });
    },
  });
}

/** Cria o comunicado e as notificações; devolve quantos responsáveis foram avisados. */
export function useCriarComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { titulo: string; mensagem: string; turmaId: string | null; alunoIds?: string[] }) =>
      unwrap<number>(
        await getSupabase().rpc("criar_comunicado", {
          p_titulo: c.titulo,
          p_mensagem: c.mensagem,
          p_turma_id: c.turmaId,
          p_aluno_ids: c.alunoIds && c.alunoIds.length > 0 ? c.alunoIds : null,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comunicados"] }),
  });
}

/* ── Log de atividades (só administração) ───────────────────── */

interface LogRow {
  id: number;
  criado_em: string;
  ator_nome: string | null;
  acao: string;
  detalhes: string | null;
}

export function useLogs(limite: number) {
  return useQuery({
    queryKey: ["logs", limite],
    queryFn: async (): Promise<LogEntry[]> => {
      const rows = unwrap<LogRow[]>(
        await getSupabase()
          .from("logs")
          .select("id, criado_em, ator_nome, acao, detalhes")
          .order("criado_em", { ascending: false })
          .limit(limite),
      );
      return rows.map((r) => ({
        id: r.id,
        criadoEm: r.criado_em,
        atorNome: r.ator_nome,
        acao: r.acao,
        detalhes: r.detalhes,
      }));
    },
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
