-- =====================================================================
--  QR Dinâmico (Kapuzinho 3D) — banco no Supabase
--  Cole TUDO no Supabase → SQL Editor → Run. Pode rodar de novo sem problema.
-- =====================================================================

-- quem pode usar o painel (só quem estiver aqui vê/edita os links)
create table if not exists public.qr_admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text,
  criado_em timestamptz not null default now()
);

-- os QR codes / links
create table if not exists public.qr_links (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique check (codigo ~ '^[a-z0-9_-]{3,32}$'),
  nome            text not null,                       -- identificação: "Placa Google - Barbearia RB"
  cliente         text,
  telefone        text,
  observacao      text,
  destino         text check (destino is null or destino ~* '^https?://'),
  validade        date,                                -- vale até o fim desse dia (horário de Brasília); vazio = sem validade
  ativo           boolean not null default true,
  destino_vencido text check (destino_vencido is null or destino_vencido ~* '^https?://'), -- opcional: pra onde mandar depois de vencer
  cliques         integer not null default 0,
  ultimo_clique   timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_por      uuid default auth.uid()
);

-- cada leitura do QR
create table if not exists public.qr_cliques (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references public.qr_links(id) on delete cascade,
  em          timestamptz not null default now(),
  resultado   text not null,      -- ok | vencido | inativo | sem_destino
  dispositivo text,               -- celular | tablet | computador
  sistema     text,               -- Android | iPhone | Windows ...
  navegador   text,
  pais        text,
  regiao      text,
  cidade      text,
  origem      text                -- de onde veio (referer), quando o celular informa
);
create index if not exists qr_cliques_link_em on public.qr_cliques (link_id, em desc);

-- atualizado_em automático (só quando os dados mudam, não a cada clique)
create or replace function public.qr_tocar() returns trigger language plpgsql as $$
begin
  if row(new.codigo, new.nome, new.cliente, new.telefone, new.observacao, new.destino, new.validade, new.ativo, new.destino_vencido)
     is distinct from row(old.codigo, old.nome, old.cliente, old.telefone, old.observacao, old.destino, old.validade, old.ativo, old.destino_vencido)
  then new.atualizado_em := now(); end if;
  return new;
end $$;
drop trigger if exists qr_links_tocar on public.qr_links;
create trigger qr_links_tocar before update on public.qr_links for each row execute function public.qr_tocar();

-- é admin?
create or replace function public.qr_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.qr_admins where user_id = auth.uid())
$$;

-- segurança: só admins mexem nos links e veem os cliques
alter table public.qr_admins  enable row level security;
alter table public.qr_links   enable row level security;
alter table public.qr_cliques enable row level security;

drop policy if exists "admin ve a si" on public.qr_admins;
create policy "admin ve a si" on public.qr_admins for select using (user_id = auth.uid());

drop policy if exists "admins links" on public.qr_links;
create policy "admins links" on public.qr_links for all using (public.qr_eh_admin()) with check (public.qr_eh_admin());

drop policy if exists "admins cliques ver" on public.qr_cliques;
create policy "admins cliques ver" on public.qr_cliques for select using (public.qr_eh_admin());
drop policy if exists "admins cliques apagar" on public.qr_cliques;
create policy "admins cliques apagar" on public.qr_cliques for delete using (public.qr_eh_admin());

-- usada pelo redirecionamento (/codigo): devolve o destino e registra o clique.
-- Roda com a chave pública (anon), mas só devolve o necessário pra redirecionar.
create or replace function public.qr_abrir(
  p_codigo text, p_contar boolean default true,
  p_dispositivo text default null, p_sistema text default null, p_navegador text default null,
  p_pais text default null, p_regiao text default null, p_cidade text default null, p_origem text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.qr_links;
  st text;
begin
  select * into l from public.qr_links where codigo = lower(trim(p_codigo));
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;

  st := case
    when not l.ativo then 'inativo'
    when l.validade is not null and l.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
    when coalesce(l.destino, '') = '' then 'sem_destino'
    else 'ok' end;

  if p_contar then
    insert into public.qr_cliques (link_id, resultado, dispositivo, sistema, navegador, pais, regiao, cidade, origem)
    values (l.id, st, left(p_dispositivo, 20), left(p_sistema, 30), left(p_navegador, 30),
            left(p_pais, 60), left(p_regiao, 60), left(p_cidade, 80), left(p_origem, 300));
    if st = 'ok' then
      update public.qr_links set cliques = cliques + 1, ultimo_clique = now() where id = l.id;
    end if;
  end if;

  return jsonb_build_object(
    'status', st,
    'destino', case st when 'ok' then l.destino when 'vencido' then l.destino_vencido end
  );
end $$;

revoke all on function public.qr_abrir(text, boolean, text, text, text, text, text, text, text) from public;
grant execute on function public.qr_abrir(text, boolean, text, text, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
--  DEPOIS de criar seu usuário (Authentication → Users → Add user),
--  rode isto trocando o e-mail, pra liberar o painel pra você:
--
--  insert into public.qr_admins (user_id, email)
--  select id, email from auth.users where email = 'SEU-EMAIL@gmail.com'
--  on conflict do nothing;
-- =====================================================================
