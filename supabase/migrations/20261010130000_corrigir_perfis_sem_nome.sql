-- Corrige perfis criados pela tela "Usuários" ANTES da migração 20261009120000:
-- o gatilho antigo não lia o app_metadata, então o perfil ficou com o CPF como nome
-- e sem CPF preenchido. Os dados certos estão na própria conta (auth.users.raw_app_meta_data).
-- Pode rodar mais de uma vez: só mexe em perfis sem CPF que tenham CPF no app_metadata.

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

-- Confira: como ficaram os perfis
select name, role, username, cpf from public.profiles order by role, name;
