-- ⚠ NÃO RODE DE NOVO: arquivo histórico, já aplicado. Rodar outra vez volta o gatilho de perfil
-- para uma versão antiga (contas novas ficam com o CPF no lugar do nome).
-- Se isso acontecer, rode 20261012000000_corrigir_gatilho_perfil.sql.

-- Portal Escolar — esquema inicial
-- Rodar uma vez no Supabase: SQL Editor > New query > colar tudo > Run.
--
-- Decisões de segurança:
--   * Todas as tabelas têm RLS ligado e só recebem GRANT explícito (o projeto foi criado
--     com "Automatically expose new tables" desligado).
--   * Perfil/papel NUNCA é decidido pelo navegador: o gatilho de cadastro força RESPONSAVEL
--     e só funções SECURITY DEFINER (com checagem de papel) mudam papel ou criam comunicados.
--   * Nenhuma senha é guardada aqui: quem cuida disso é o Supabase Auth.

-- ───────────────────────── Tipos ─────────────────────────
create type public.user_role as enum ('ADMIN', 'DEV', 'PROFESSOR', 'RESPONSAVEL');

-- ───────────────────────── Tabelas ─────────────────────────
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  name                 text not null check (char_length(name) between 2 and 120),
  username             text not null unique check (username = lower(username)),
  cpf                  text unique check (cpf ~ '^\d{11}$'),
  data_nascimento      date,
  role                 public.user_role not null default 'RESPONSAVEL',
  requested_professor  boolean not null default false,
  created_at           timestamptz not null default now()
);

create table public.turmas (
  id             uuid primary key default gen_random_uuid(),
  ano            text not null,
  sufixo         text not null,
  ano_letivo     int  not null,
  codigo_acesso  text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at     timestamptz not null default now(),
  unique (ano, sufixo, ano_letivo)
);

create table public.alunos (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 120),
  cpf             text not null unique check (cpf ~ '^\d{11}$'),
  turma_id        uuid not null references public.turmas (id) on delete restrict,
  responsavel_id  uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index alunos_turma_idx      on public.alunos (turma_id);
create index alunos_responsavel_idx on public.alunos (responsavel_id);

create table public.comunicados (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(titulo) between 1 and 150),
  mensagem    text not null check (char_length(mensagem) between 1 and 5000),
  turma_id    uuid references public.turmas (id) on delete cascade, -- null = toda a escola
  autor_id    uuid not null references public.profiles (id),
  criado_em   timestamptz not null default now()
);
create index comunicados_turma_idx on public.comunicados (turma_id);

create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  comunicado_id  uuid not null references public.comunicados (id) on delete cascade,
  lida           boolean not null default false,
  criado_em      timestamptz not null default now(),
  unique (user_id, comunicado_id)
);
create index notificacoes_user_idx on public.notificacoes (user_id, lida);

-- ───────────────────────── Funções auxiliares ─────────────────────────
-- SECURITY DEFINER para poder consultar profiles sem cair em recursão de RLS.
create function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'DEV')
  );
$$;

create function public.eh_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'DEV', 'PROFESSOR')
  );
$$;

-- ───────────────────────── Cadastro: cria o perfil sozinho ─────────────────────────
-- O papel é sempre RESPONSAVEL. Para criar o primeiro ADMIN, veja o final deste arquivo.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, username, cpf, data_nascimento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), ''),
    nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Ações com regra (RPC) ─────────────────────────
create function public.solicitar_professor() returns void
language sql security definer set search_path = '' as $$
  update public.profiles
     set requested_professor = true
   where id = (select auth.uid()) and role = 'RESPONSAVEL';
$$;

create function public.aprovar_professor(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.profiles
     set role = 'PROFESSOR', requested_professor = false
   where id = p_user and requested_professor;
end;
$$;

create function public.recusar_professor(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.profiles set requested_professor = false where id = p_user;
end;
$$;

-- Cria o comunicado e uma notificação para cada responsável do destino.
-- Retorna quantos responsáveis foram avisados.
create function public.criar_comunicado(p_titulo text, p_mensagem text, p_turma_id uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_total int;
begin
  if not public.eh_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  insert into public.comunicados (titulo, mensagem, turma_id, autor_id)
  values (trim(p_titulo), trim(p_mensagem), p_turma_id, (select auth.uid()))
  returning id into v_id;

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
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles     enable row level security;
alter table public.turmas       enable row level security;
alter table public.alunos       enable row level security;
alter table public.comunicados  enable row level security;
alter table public.notificacoes enable row level security;

-- profiles: cada um vê o próprio; equipe vê todos. Só o nome pode ser editado direto.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.eh_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- turmas: todo usuário logado lê (precisa escolher a turma do filho); a equipe
-- (professor, admin, dev) cria, edita e apaga.
create policy turmas_select on public.turmas for select to authenticated using (true);
create policy turmas_insert on public.turmas for insert to authenticated with check (public.eh_staff());
create policy turmas_update on public.turmas for update to authenticated
  using (public.eh_staff()) with check (public.eh_staff());
create policy turmas_delete on public.turmas for delete to authenticated using (public.eh_staff());

-- alunos: o responsável vê e cadastra só os próprios filhos; professor só consulta;
-- admin/dev alteram todos. O CPF único impede cadastrar a mesma criança duas vezes.
create policy alunos_select on public.alunos for select to authenticated
  using (responsavel_id = (select auth.uid()) or public.eh_staff());
create policy alunos_insert on public.alunos for insert to authenticated
  with check (responsavel_id = (select auth.uid()) or public.eh_admin());
create policy alunos_update on public.alunos for update to authenticated
  using (responsavel_id = (select auth.uid()) or public.eh_admin())
  with check (responsavel_id = (select auth.uid()) or public.eh_admin());
create policy alunos_delete on public.alunos for delete to authenticated
  using (responsavel_id = (select auth.uid()) or public.eh_admin());

-- comunicados: equipe vê todos; responsável vê os da escola toda e das turmas dos filhos.
-- Não há policy de INSERT: a criação passa por public.criar_comunicado().
create policy comunicados_select on public.comunicados for select to authenticated
  using (
    public.eh_staff()
    or turma_id is null
    or exists (
      select 1 from public.alunos a
       where a.turma_id = comunicados.turma_id
         and a.responsavel_id = (select auth.uid())
    )
  );

-- notificacoes: cada um vê e marca como lida só as suas.
create policy notificacoes_select on public.notificacoes for select to authenticated
  using (user_id = (select auth.uid()));
create policy notificacoes_update on public.notificacoes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───────────────────────── Permissões (GRANT) ─────────────────────────
-- Nada para o papel "anon": sem login, nada é acessível.
grant usage on schema public to authenticated;

grant select                         on public.profiles     to authenticated;
grant update (name)                  on public.profiles     to authenticated;
grant select, insert, update, delete on public.turmas       to authenticated;
grant select, insert, update, delete on public.alunos       to authenticated;
grant select                         on public.comunicados  to authenticated;
grant select                         on public.notificacoes to authenticated;
grant update (lida)                  on public.notificacoes to authenticated;

-- Funções: só usuários logados podem chamar.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.eh_admin(), public.eh_staff(),
  public.solicitar_professor(),
  public.aprovar_professor(uuid), public.recusar_professor(uuid),
  public.criar_comunicado(text, text, uuid)
to authenticated;

-- ───────────────────────── Tempo real ─────────────────────────
-- O sino de notificações recebe novas linhas sem recarregar a página (respeita o RLS).
alter publication supabase_realtime add table public.notificacoes;

-- ───────────────────────── Primeiro administrador ─────────────────────────
-- 1) No painel: Authentication > Users > Add user (e-mail interno, ex.: admin@escola.local,
--    com a senha que você escolher). O gatilho cria o perfil como RESPONSAVEL.
-- 2) Rode, trocando o e-mail:
--
--   update public.profiles
--      set role = 'ADMIN', username = 'admin', name = 'Administrador'
--    where id = (select id from auth.users where email = 'admin@escola.local');
