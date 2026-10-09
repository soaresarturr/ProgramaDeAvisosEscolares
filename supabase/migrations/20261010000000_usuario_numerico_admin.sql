-- Usuário passa a ser só números. Pais e professores já entram com o CPF;
-- as contas da administração criadas à mão no painel ("admin", "dev") ganham um número próprio.
-- A SENHA NÃO MUDA.
--
-- Rode uma vez no SQL Editor, ANTES de publicar a versão nova do site
-- (o site novo não aceita mais letras no usuário).
--
-- Troque os números abaixo se quiser outros. Regras: só dígitos, sem zero à esquerda
-- e com MENOS de 11 dígitos (assim nunca coincidem com um CPF).

do $$
declare
  v_contas constant jsonb := '{"admin": "1001", "dev": "1002"}';
  v_antigo text;
  v_novo   text;
  v_id     uuid;
begin
  for v_antigo, v_novo in select key, value from jsonb_each_text(v_contas) loop
    if v_novo !~ '^[1-9]\d{0,9}$' then
      raise exception 'Número inválido para %: % (só dígitos, sem zero à esquerda, até 10 dígitos)', v_antigo, v_novo;
    end if;

    select id into v_id from auth.users where email = v_antigo || '@escola.local';
    continue when v_id is null; -- essa conta não existe: nada a fazer

    if exists (select 1 from auth.users where email = v_novo || '@escola.local') then
      raise exception 'O número % já está em uso por outra conta', v_novo;
    end if;

    -- Login (e-mail interno) e o registro de identidade do provedor de e-mail
    update auth.users set email = v_novo || '@escola.local' where id = v_id;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_novo || '@escola.local'))
     where user_id = v_id and provider = 'email';

    -- Nome de usuário mostrado no site
    update public.profiles set username = v_novo where id = v_id;

    raise notice 'Conta "%" agora entra com o usuário %', v_antigo, v_novo;
  end loop;
end $$;

-- Confira o resultado: contas sem CPF (administração) e o usuário de cada uma.
select p.name, p.role, p.username, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.cpf is null
 order by p.role, p.name;
