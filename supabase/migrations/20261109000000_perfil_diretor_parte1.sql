-- Novo perfil DIRETOR (direção da escola) — PARTE 1 de 2.
-- Rode SOZINHA no SQL Editor e só depois rode a parte 2
-- (o Postgres não deixa usar um valor novo de enum na mesma execução em que ele foi criado).

alter type public.user_role add value if not exists 'DIRETOR';
