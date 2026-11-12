-- Conserta (de novo) contas novas que aparecem com o CPF no lugar do nome ("Bom dia, 123...")
-- e deixa a criação de usuários independente da versão do gatilho.
-- Pode rodar mais de uma vez sem problema. Rode inteiro no SQL Editor.
--
-- Causa: o banco de produção estava com uma versão ANTIGA de handle_new_user, que lê
-- raw_user_meta_data. A Edge Function manda os dados em app_metadata, então o gatilho antigo
-- não achava o nome e usava a parte antes do @ do e-mail (= o CPF), sem CPF e como RESPONSAVEL.

-- ───────────────────────── 1) Gatilho certo ─────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_cpf  text := nullif(regexp_replace(coalesce(v_meta ->> 'cpf', ''), '\D', '', 'g'), '');
  v_name text := trim(coalesce(v_meta ->> 'name', new.raw_user_meta_data ->> 'name', ''));
  v_role public.user_role := coalesce(nullif(v_meta ->> 'role', '')::public.user_role, 'RESPONSAVEL');
begin
  if v_cpf is not null then
    if char_length(v_cpf) <> 11 or v_name = '' then
      raise exception 'Cadastro inválido' using errcode = '22023';
    end if;
    insert into public.profiles (id, name, username, cpf, role)
    values (new.id, v_name, v_cpf, v_cpf, v_role);
  else
    insert into public.profiles (id, name, username, role)
    values (
      new.id,
      coalesce(nullif(v_name, ''), split_part(new.email, '@', 1)),
      lower(split_part(new.email, '@', 1)),
      v_role
    );
  end if;
  return new;
end;
$$;

-- ───────────────────────── 2) Edge Function pode gravar o perfil ─────────────────────────
-- A função "gerenciar-usuarios" confirma nome/CPF/papel logo depois de criar a conta.
grant update (name, username, cpf, role) on public.profiles to service_role;

-- ───────────────────────── 3) Conserta os perfis já criados errados ─────────────────────────
update public.profiles p
   set name     = trim(u.raw_app_meta_data ->> 'name'),
       cpf      = regexp_replace(u.raw_app_meta_data ->> 'cpf', '\D', '', 'g'),
       username = regexp_replace(u.raw_app_meta_data ->> 'cpf', '\D', '', 'g'),
       role     = coalesce(nullif(u.raw_app_meta_data ->> 'role', '')::public.user_role, p.role)
  from auth.users u
 where u.id = p.id
   and p.cpf is null
   and coalesce(u.raw_app_meta_data ->> 'cpf', '') <> ''
   and coalesce(trim(u.raw_app_meta_data ->> 'name'), '') <> '';

-- ───────────────────────── 4) Confira ─────────────────────────
-- gatilho_certo deve ser true, e ninguém da lista deve ter o CPF no campo "name".
select
  (select prosrc like '%raw_app_meta_data%' from pg_proc where proname = 'handle_new_user') as gatilho_certo,
  p.name, p.role, p.username, p.cpf
  from public.profiles p
 order by p.role, p.name;
