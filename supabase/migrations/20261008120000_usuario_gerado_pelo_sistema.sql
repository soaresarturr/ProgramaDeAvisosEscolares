-- O usuário passa a ser SEMPRE gerado pelo banco (primeiro nome + 3 últimos dígitos do CPF).
-- Antes, o navegador mandava o "username" nos metadados do cadastro e o gatilho confiava nele,
-- então alguém com a chave anon poderia se cadastrar com o usuário que quisesse.
-- Rode uma vez no SQL Editor (depois do schema inicial).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  v_cpf  text := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), '');
begin
  if v_cpf is not null then
    -- Cadastro de responsável: usuário gerado pelo sistema.
    if char_length(v_cpf) <> 11 or v_name = '' then
      raise exception 'Cadastro inválido' using errcode = '22023';
    end if;
    insert into public.profiles (id, name, username, cpf, data_nascimento)
    values (
      new.id,
      v_name,
      lower(split_part(v_name, ' ', 1)) || right(v_cpf, 3),
      v_cpf,
      nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
    );
  else
    -- Conta criada pelo painel do Supabase (ex.: o administrador): usa a parte antes do @.
    insert into public.profiles (id, name, username)
    values (
      new.id,
      coalesce(nullif(v_name, ''), split_part(new.email, '@', 1)),
      lower(split_part(new.email, '@', 1))
    );
  end if;
  return new;
end;
$$;
