-- Só a administração (ADMIN/DEV) cadastra, altera e remove alunos.
-- Antes, o responsável podia cadastrar "filhos" para si mesmo.
-- O responsável continua VENDO os próprios filhos; o professor continua só consultando.
-- (A passagem de ano feita pela professora segue pela função public.passar_ano.)
-- Rode uma vez no SQL Editor.

drop policy if exists alunos_insert on public.alunos;
drop policy if exists alunos_update on public.alunos;
drop policy if exists alunos_delete on public.alunos;

create policy alunos_insert on public.alunos for insert to authenticated
  with check (public.eh_admin());
create policy alunos_update on public.alunos for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
create policy alunos_delete on public.alunos for delete to authenticated
  using (public.eh_admin());
