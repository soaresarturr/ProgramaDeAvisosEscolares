-- 1) Comunicado PRIVADO para alunos escolhidos (só os responsáveis deles recebem e veem)
-- 2) Nome de quem enviou cada comunicado
-- 3) Log de atividades para a administração
-- Rode uma vez no SQL Editor (depois das migrações anteriores).

-- ───────────────────────── 2) Autor do comunicado ─────────────────────────
-- Guardamos o NOME (e não só o id): o responsável não tem acesso aos perfis da equipe,
-- e o nome continua aparecendo mesmo se a conta de quem enviou for removida.
alter table public.comunicados add column if not exists autor_nome text;
update public.comunicados c
   set autor_nome = p.name
  from public.profiles p
 where p.id = c.autor_id and c.autor_nome is null;

-- ───────────────────────── 1) Comunicado privado ─────────────────────────
alter table public.comunicados add column if not exists privado boolean not null default false;

create table if not exists public.comunicado_alunos (
  comunicado_id uuid not null references public.comunicados (id) on delete cascade,
  aluno_id      uuid not null references public.alunos (id) on delete cascade,
  primary key (comunicado_id, aluno_id)
);
create index if not exists comunicado_alunos_aluno_idx on public.comunicado_alunos (aluno_id);

alter table public.comunicado_alunos enable row level security;

-- Equipe vê todos os destinatários; o responsável só enxerga os PRÓPRIOS filhos na lista
-- (nunca descobre quais outros alunos receberam a mesma mensagem).
drop policy if exists comunicado_alunos_select on public.comunicado_alunos;
create policy comunicado_alunos_select on public.comunicado_alunos for select to authenticated
  using (
    public.eh_staff()
    or exists (
      select 1 from public.alunos a
       where a.id = comunicado_alunos.aluno_id
         and a.responsavel_id = (select auth.uid())
    )
  );
grant select on public.comunicado_alunos to authenticated;

-- Quem vê cada comunicado
drop policy if exists comunicados_select on public.comunicados;
create policy comunicados_select on public.comunicados for select to authenticated
  using (
    public.eh_staff()
    or (
      not privado
      and (
        turma_id is null
        or exists (
          select 1 from public.alunos a
           where a.turma_id = comunicados.turma_id
             and a.responsavel_id = (select auth.uid())
        )
      )
    )
    or (
      privado
      and exists (
        select 1
          from public.comunicado_alunos ca
          join public.alunos a on a.id = ca.aluno_id
         where ca.comunicado_id = comunicados.id
           and a.responsavel_id = (select auth.uid())
      )
    )
  );

-- Nova versão de criar_comunicado: escola toda, uma turma OU alunos escolhidos (privado)
drop function if exists public.criar_comunicado(text, text, uuid);

create function public.criar_comunicado(
  p_titulo    text,
  p_mensagem  text,
  p_turma_id  uuid,
  p_aluno_ids uuid[] default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_total   int;
  v_privado boolean := coalesce(cardinality(p_aluno_ids), 0) > 0;
begin
  if not public.eh_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_privado and p_turma_id is not null then
    raise exception 'Escolha uma turma OU alunos, não os dois' using errcode = '22023';
  end if;

  insert into public.comunicados (titulo, mensagem, turma_id, autor_id, autor_nome, privado)
  values (
    trim(p_titulo),
    trim(p_mensagem),
    p_turma_id,
    (select auth.uid()),
    (select name from public.profiles where id = (select auth.uid())),
    v_privado
  )
  returning id into v_id;

  if v_privado then
    insert into public.comunicado_alunos (comunicado_id, aluno_id)
    select v_id, unnest(p_aluno_ids)
    on conflict do nothing;

    insert into public.notificacoes (user_id, comunicado_id)
    select distinct a.responsavel_id, v_id
      from public.alunos a
     where a.id = any (p_aluno_ids);
  else
    insert into public.notificacoes (user_id, comunicado_id)
    select p.id, v_id
      from public.profiles p
     where p.role = 'RESPONSAVEL'
       and (
         p_turma_id is null
         or exists (
           select 1 from public.alunos a
            where a.responsavel_id = p.id and a.turma_id = p_turma_id
         )
       );
  end if;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke execute on function public.criar_comunicado(text, text, uuid, uuid[]) from public, anon;
grant execute on function public.criar_comunicado(text, text, uuid, uuid[]) to authenticated;

-- ───────────────────────── 3) Log de atividades ─────────────────────────
create table if not exists public.logs (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  ator_id    uuid,          -- sem FK de propósito: o registro continua se a conta for removida
  ator_nome  text,
  acao       text not null,
  detalhes   text
);
create index if not exists logs_criado_em_idx on public.logs (criado_em desc);

alter table public.logs enable row level security;

-- Só a administração lê. Ninguém escreve pelo site: quem grava são os gatilhos
-- abaixo e a Edge Function de usuários.
drop policy if exists logs_select on public.logs;
create policy logs_select on public.logs for select to authenticated using (public.eh_admin());
grant select on public.logs to authenticated;
grant insert on public.logs to service_role;

create or replace function public.registrar_log(p_acao text, p_detalhes text) returns void
language sql security definer set search_path = '' as $$
  insert into public.logs (ator_id, ator_nome, acao, detalhes)
  values (
    (select auth.uid()),
    coalesce((select name from public.profiles where id = (select auth.uid())), 'Sistema'),
    p_acao,
    p_detalhes
  );
$$;
revoke execute on function public.registrar_log(text, text) from public, anon, authenticated;

create or replace function public.turma_label(p_turma_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select 'Turma ' || ano || sufixo || ' · ' || ano_letivo from public.turmas where id = p_turma_id;
$$;
revoke execute on function public.turma_label(uuid) from public, anon, authenticated;

-- Turmas
create or replace function public.log_turmas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_log('Turma criada',
      'Turma ' || new.ano || new.sufixo || ' · ' || new.ano_letivo);
  elsif tg_op = 'UPDATE' then
    perform public.registrar_log('Turma editada',
      'Turma ' || old.ano || old.sufixo || ' · ' || old.ano_letivo || ' → ' ||
      'Turma ' || new.ano || new.sufixo || ' · ' || new.ano_letivo);
  else
    perform public.registrar_log('Turma removida',
      'Turma ' || old.ano || old.sufixo || ' · ' || old.ano_letivo);
  end if;
  return null;
end;
$$;
drop trigger if exists log_turmas on public.turmas;
create trigger log_turmas after insert or update or delete on public.turmas
  for each row execute function public.log_turmas();

-- Alunos (inclui a passagem de ano, que muda a turma)
create or replace function public.log_alunos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_log('Aluno cadastrado',
      new.name || ' (' || coalesce(public.turma_label(new.turma_id), 'sem turma') || ')');
  elsif tg_op = 'UPDATE' then
    if new.turma_id is distinct from old.turma_id then
      perform public.registrar_log('Aluno mudou de turma',
        new.name || ': ' || coalesce(public.turma_label(old.turma_id), '?') || ' → ' ||
        coalesce(public.turma_label(new.turma_id), '?'));
    else
      perform public.registrar_log('Aluno editado', new.name);
    end if;
  else
    perform public.registrar_log('Aluno removido', old.name);
  end if;
  return null;
end;
$$;
drop trigger if exists log_alunos on public.alunos;
create trigger log_alunos after insert or update or delete on public.alunos
  for each row execute function public.log_alunos();

-- Comunicados
create or replace function public.log_comunicados() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.registrar_log(
    case when new.privado then 'Mensagem privada enviada' else 'Comunicado enviado' end,
    '"' || new.titulo || '" para ' ||
    case
      when new.privado then 'alunos escolhidos'
      when new.turma_id is null then 'toda a escola'
      else coalesce(public.turma_label(new.turma_id), 'uma turma')
    end
  );
  return null;
end;
$$;
drop trigger if exists log_comunicados on public.comunicados;
create trigger log_comunicados after insert on public.comunicados
  for each row execute function public.log_comunicados();
