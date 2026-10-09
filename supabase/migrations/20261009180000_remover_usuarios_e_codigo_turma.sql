-- Remoção de cadastros pela administração + fim do código de acesso das turmas.
-- Rode uma vez no SQL Editor (depois das migrações anteriores).
--
-- Ao remover a conta de um usuário (Edge Function "gerenciar-usuarios"), o banco apaga em cascata:
--   conta → perfil → filhos (alunos) → notificações → aparelhos de push.
-- Comunicados escritos por quem foi removido continuam existindo, só sem autor.

alter table public.comunicados alter column autor_id drop not null;
alter table public.comunicados drop constraint if exists comunicados_autor_id_fkey;
alter table public.comunicados
  add constraint comunicados_autor_id_fkey
  foreign key (autor_id) references public.profiles (id) on delete set null;

-- O código/QR Code para entrar na turma não é mais usado.
alter table public.turmas drop column if exists codigo_acesso;
