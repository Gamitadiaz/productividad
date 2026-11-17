-- Esquema de sincronización para Productividad.
-- Ejecútalo una vez en Supabase: Dashboard → SQL Editor → New query → pegar → Run.
-- Es idempotente: puedes volver a correrlo sin romper nada.

-- Una fila por elemento (tarea, hábito, sesión o ajustes) de cada usuario.
create table if not exists public.items (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection        text        not null check (collection in ('tasks', 'habits', 'sessions', 'settings')),
  id                text        not null check (char_length(id) <= 100),
  data              jsonb,
  deleted           boolean     not null default false,
  -- Hora de la edición en el cliente (ms). Decide quién gana en un conflicto.
  updated_at        bigint      not null,
  -- Hora en que el servidor recibió el cambio. Es el cursor para descargar cambios.
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists items_user_server_updated_idx
  on public.items (user_id, server_updated_at);

-- "Gana la última edición": si llega una versión más vieja que la guardada, se ignora.
create or replace function public.items_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- descarta la actualización sin error
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists items_last_write_wins on public.items;
create trigger items_last_write_wins
  before insert or update on public.items
  for each row execute function public.items_last_write_wins();

-- Seguridad a nivel de fila: cada quien sólo ve y modifica lo suyo.
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;

create policy "items_select_own" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "items_insert_own" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "items_update_own" on public.items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "items_delete_own" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Cambios en tiempo real entre dispositivos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;
