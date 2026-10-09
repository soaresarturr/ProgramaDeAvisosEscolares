-- Contas passam a ser criadas só pela administração (Edge Function "gerenciar-usuarios").
--   * Login = CPF (por baixo: <cpf>@escola.local)
--   * Senha padrão = primeiro nome (minúsculo, sem acento) + CPF — gerada pela Edge Function
--   * O pedido "Sou Professor" deixa de existir: o admin já cria o professor direto.
-- Rode uma vez no SQL Editor (depois das migrações anteriores).
-- Depois, no painel: Authentication → Sign In / Providers → desligue "Allow new users to sign up".

-- ───────────────────────── Perfil criado a partir da conta ─────────────────────────
-- Nome, CPF e papel vêm do app_metadata, que SÓ a chave de serviço consegue definir
-- (o cadastro público não consegue escrever ali). Sem app_metadata → responsável sem CPF
-- (caso de contas criadas à mão no painel, como o primeiro admin).
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

-- ───────────────────────── Fim do pedido "Sou Professor" ─────────────────────────
drop function if exists public.solicitar_professor();
drop function if exists public.aprovar_professor(uuid);
drop function if exists public.recusar_professor(uuid);
update public.profiles set requested_professor = false where requested_professor;

-- ───────────────────────── Permissão da Edge Function ─────────────────────────
-- Ela confere o papel de quem chamou e lê nome/CPF para redefinir a senha.
grant select on public.profiles to service_role;
