-- Passagem de ano feita pela professora + assinaturas de Web Push.
-- Rode uma vez no SQL Editor (depois das migrações anteriores).

-- ───────────────────────── Passagem de ano ─────────────────────────
-- A professora não gerencia alunos (não cria, não edita, não apaga), mas no fim do ano
-- precisa mudar a turma deles. Esta função faz SÓ isso, e só para a equipe.
-- p_movimentos: [{"aluno_id": "...", "turma_id": "..."}, ...]
create function public.passar_ano(p_movimentos jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
begin
  if not public.eh_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.alunos a
     set turma_id = (m ->> 'turma_id')::uuid
    from jsonb_array_elements(p_movimentos) m
   where a.id = (m ->> 'aluno_id')::uuid;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke execute on function public.passar_ano(jsonb) from public, anon;
grant execute on function public.passar_ano(jsonb) to authenticated;

-- ───────────────────────── Web Push ─────────────────────────
-- Cada celular/navegador onde o responsável ativou os avisos vira uma linha aqui.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada um só vê, cadastra e remove os próprios aparelhos.
-- Quem lê todas para enviar é a Edge Function, com a chave de serviço (fora do navegador).
create policy push_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_update on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- A Edge Function de envio usa a chave de serviço. Como o projeto não expõe tabelas
-- automaticamente, ela também precisa de GRANT explícito (só leitura e limpeza).
grant usage on schema public to service_role;
grant select, delete on public.push_subscriptions to service_role;
grant select on public.notificacoes, public.comunicados to service_role;

-- Aparelhos que devem receber o push de um comunicado: os dos responsáveis que
-- ganharam notificação dele. Só a Edge Function (chave de serviço) pode chamar.
create function public.push_destinos(p_comunicado_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join public.notificacoes n on n.user_id = s.user_id
   where n.comunicado_id = p_comunicado_id;
$$;

revoke execute on function public.push_destinos(uuid) from public, anon, authenticated;
grant execute on function public.push_destinos(uuid) to service_role;
