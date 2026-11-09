-- Novo perfil DIRETOR (direção da escola) — PARTE 2 de 2. Rode depois da parte 1.
-- Pode rodar mais de uma vez sem problema.
--
-- O DIRETOR pode tudo que a administração (ADMIN) pode: criar/remover pais e professores,
-- cadastrar alunos, turmas, comunicados, passagem de ano...
-- A ÚNICA diferença: NÃO vê o Registro de atividades (log). Esse continua só para ADMIN e DEV.
-- As ações do diretor continuam sendo registradas no log normalmente.

-- ───────────────────────── 1) Permissões ─────────────────────────
-- "Administração" passa a incluir o diretor (todas as regras que usam eh_admin/eh_staff).
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'DEV', 'DIRETOR')
  );
$$;

create or replace function public.eh_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'DEV', 'DIRETOR', 'PROFESSOR')
  );
$$;

-- Quem lê o log: só ADMIN e DEV (o diretor fica de fora).
create or replace function public.ve_logs() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('ADMIN', 'DEV')
  );
$$;
revoke execute on function public.ve_logs() from public, anon;
grant execute on function public.ve_logs() to authenticated;

drop policy if exists logs_select on public.logs;
create policy logs_select on public.logs for select to authenticated using (public.ve_logs());

-- ───────────────────────── 2) Conta do diretor ─────────────────────────
-- ANTES de rodar este bloco, crie a conta no painel:
--   Authentication > Users > Add user > Create new user
--     E-mail:  1003@escola.local      (o login no site será só: 1003)
--     Senha:   a que vocês escolherem para passar ao diretor
--     Marque "Auto Confirm User".
-- Quer outro número? Troque 1003 abaixo e no e-mail (só dígitos, sem zero à esquerda,
-- até 10 dígitos, e diferente de 1001/1002). Troque também o nome, se quiser.
-- Se a conta ainda não existir, este bloco só avisa e não faz nada.
do $$
declare
  v_login constant text := '1003';
  v_nome  constant text := 'Direção';
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_login || '@escola.local';
  if v_id is null then
    raise notice 'Conta %@escola.local não encontrada: crie no painel e rode este arquivo de novo.', v_login;
    return;
  end if;

  update public.profiles
     set role = 'DIRETOR', name = v_nome, username = v_login
   where id = v_id;

  raise notice 'Conta % agora é DIRETOR', v_login;
end $$;

-- ───────────────────────── 3) Confira ─────────────────────────
select p.name, p.role, p.username, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.cpf is null
 order by p.role, p.name;
