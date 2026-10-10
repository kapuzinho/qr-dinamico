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

-- =====================================================================
--  CLIENTES (página do cliente): cada cliente vê só os QRs dele,
--  cria até o limite e só troca nome / destino / observação.
-- =====================================================================
create table if not exists public.qr_clientes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete set null,   -- preenchido no 1º acesso
  nome       text not null,
  email      text not null unique check (email = lower(email) and position('@' in email) > 1),
  telefone   text,
  limite     integer not null default 5 check (limite between 0 and 1000),
  validade   date,                      -- validade do plano (vazio = sem validade)
  ativo      boolean not null default true,
  observacao text,
  criado_em  timestamptz not null default now()
);
alter table public.qr_links add column if not exists dono uuid references public.qr_clientes(id) on delete set null;
alter table public.qr_clientes add column if not exists limite_pix integer not null default 10 check (limite_pix between 0 and 1000);
create index if not exists qr_links_dono on public.qr_links (dono);

-- id do cliente logado (só se estiver ativo)
create or replace function public.qr_meu_cliente() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.qr_clientes where user_id = auth.uid() and ativo
$$;

alter table public.qr_clientes enable row level security;
drop policy if exists "admins clientes" on public.qr_clientes;
create policy "admins clientes" on public.qr_clientes for all using (public.qr_eh_admin()) with check (public.qr_eh_admin());
drop policy if exists "cliente ve seu cadastro" on public.qr_clientes;
create policy "cliente ve seu cadastro" on public.qr_clientes for select using (user_id = auth.uid());

drop policy if exists "cliente ve seus links" on public.qr_links;
create policy "cliente ve seus links" on public.qr_links for select using (dono is not null and dono = public.qr_meu_cliente());
drop policy if exists "cliente cria links" on public.qr_links;
create policy "cliente cria links" on public.qr_links for insert with check (dono is not null and dono = public.qr_meu_cliente());
drop policy if exists "cliente edita links" on public.qr_links;
create policy "cliente edita links" on public.qr_links for update using (dono is not null and dono = public.qr_meu_cliente()) with check (dono = public.qr_meu_cliente());
drop policy if exists "cliente ve cliques" on public.qr_cliques;
create policy "cliente ve cliques" on public.qr_cliques for select
  using (exists (select 1 from public.qr_links l where l.id = link_id and l.dono is not null and l.dono = public.qr_meu_cliente()));

-- regras do cliente (rodam no banco, não dá pra burlar pelo navegador)
create or replace function public.qr_regras_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.qr_clientes;
  n integer;
  v_nome text; v_dest text; v_obs text;
begin
  if auth.uid() is null or public.qr_eh_admin() then return new; end if;   -- admin e o redirecionamento passam direto
  select * into c from public.qr_clientes where user_id = auth.uid() and ativo;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if c.validade is not null and c.validade < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Seu plano venceu em %. Fale com a gente pra renovar.', to_char(c.validade, 'DD/MM/YYYY');
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(c.id::text));
    select count(*) into n from public.qr_links where dono = c.id;
    if n >= c.limite then
      raise exception 'Limite de % QR Codes atingido. Fale com a gente pra aumentar.', c.limite;
    end if;
    if new.codigo !~ '^[a-z2-9]{6,8}$' then raise exception 'Código inválido.'; end if;
    new.dono := c.id; new.ativo := true; new.validade := null; new.destino_vencido := null;
    new.cliques := 0; new.ultimo_clique := null; new.cliente := c.nome; new.telefone := c.telefone;
    new.criado_por := auth.uid(); new.criado_em := now();
    return new;
  end if;
  -- UPDATE: o cliente só muda nome, destino e observação
  v_nome := new.nome; v_dest := new.destino; v_obs := new.observacao;
  new := old;
  new.nome := v_nome; new.destino := v_dest; new.observacao := v_obs;
  return new;
end $$;
drop trigger if exists qr_links_regras on public.qr_links;
create trigger qr_links_regras before insert or update on public.qr_links for each row execute function public.qr_regras_cliente();

-- configurações do cadastro (uma linha só): cadastro aberto? limite e validade padrão de quem se cadastra sozinho
create table if not exists public.qr_config (
  id                 integer primary key default 1 check (id = 1),
  cadastro_aberto    boolean not null default true,
  limite_padrao      integer not null default 5 check (limite_padrao between 0 and 1000),
  dias_validade      integer check (dias_validade is null or dias_validade between 1 and 3650)  -- vazio = sem validade
);
alter table public.qr_config add column if not exists limite_pix_padrao integer not null default 10 check (limite_pix_padrao between 0 and 1000);
insert into public.qr_config (id) values (1) on conflict do nothing;
alter table public.qr_config enable row level security;
drop policy if exists "admins config" on public.qr_config;
create policy "admins config" on public.qr_config for all using (public.qr_eh_admin()) with check (public.qr_eh_admin());

-- chamada pela página do cliente depois do login:
--  1) se você já cadastrou esse e-mail no admin, liga o login ao cadastro;
--  2) senão, e se o cadastro estiver aberto, cria a conta do cliente na hora (limite/validade padrão).
create or replace function public.qr_vincular() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text; conf timestamptz; meta jsonb; c public.qr_clientes; cfg public.qr_config;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'sem_login'); end if;
  select lower(email), email_confirmed_at, coalesce(raw_user_meta_data, '{}'::jsonb) into e, conf, meta from auth.users where id = auth.uid();
  select * into c from public.qr_clientes where user_id = auth.uid();
  if not found and conf is not null then
    update public.qr_clientes set user_id = auth.uid() where email = e and user_id is null returning * into c;
  end if;
  if c.id is null and conf is not null and not exists (select 1 from public.qr_admins where user_id = auth.uid()) then
    select * into cfg from public.qr_config where id = 1;
    if coalesce(cfg.cadastro_aberto, true) and not exists (select 1 from public.qr_clientes where email = e) then
      insert into public.qr_clientes (user_id, nome, email, limite, limite_pix, validade, observacao)
      values (auth.uid(),
              left(coalesce(nullif(trim(meta->>'nome'), ''), nullif(trim(meta->>'full_name'), ''), nullif(trim(meta->>'name'), ''), split_part(e, '@', 1)), 120),
              e, coalesce(cfg.limite_padrao, 5), coalesce(cfg.limite_pix_padrao, 10),
              case when cfg.dias_validade is null then null else (now() at time zone 'America/Sao_Paulo')::date + cfg.dias_validade end,
              'Cadastro feito pelo site')
      returning * into c;
    end if;
  end if;
  if c.id is null then return jsonb_build_object('status', case when conf is null then 'sem_confirmar' else 'sem_cadastro' end, 'email', e); end if;
  return jsonb_build_object(
    'status', case when not c.ativo then 'bloqueado'
                   when c.validade is not null and c.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
                   else 'ok' end,
    'id', c.id, 'nome', c.nome, 'limite', c.limite, 'limite_pix', c.limite_pix, 'validade', c.validade, 'ativo', c.ativo,
    'usados', (select count(*) from public.qr_links where dono = c.id));
end $$;
revoke all on function public.qr_vincular() from public;
grant execute on function public.qr_vincular() to authenticated;

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
  c public.qr_clientes;
  st text;
begin
  select * into l from public.qr_links where codigo = lower(trim(p_codigo));
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if l.dono is not null then
    select * into c from public.qr_clientes where id = l.dono;
  end if;

  st := case
    when c.id is not null and not c.ativo then 'inativo'
    when c.id is not null and c.validade is not null and c.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
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

-- =====================================================================
--  PIX: chaves Pix e links de pagamento (página pública /p/nome-do-link)
-- =====================================================================
create table if not exists public.pix_chaves (
  id        uuid primary key default gen_random_uuid(),
  dono      uuid references public.qr_clientes(id) on delete cascade,     -- vazio = sua (admin)
  tipo      text not null check (tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  chave     text not null check (length(chave) between 3 and 77),
  apelido   text,
  nome      text not null check (length(nome) between 2 and 60),           -- nome de quem recebe (aparece no app do banco)
  cidade    text not null default 'BRASILIA' check (length(cidade) between 2 and 40),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
create index if not exists pix_chaves_dono on public.pix_chaves (dono);

create table if not exists public.pix_links (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  dono          uuid references public.qr_clientes(id) on delete cascade,
  chave_id      uuid not null references public.pix_chaves(id) on delete restrict,
  titulo        text,
  valor         numeric(12, 2) check (valor is null or (valor > 0 and valor < 1000000)),
  descricao     text check (descricao is null or length(descricao) <= 40),
  ativo         boolean not null default true,
  acessos       integer not null default 0,
  ultimo_acesso timestamptz,
  criado_em     timestamptz not null default now(),
  criado_por    uuid default auth.uid()
);
create index if not exists pix_links_dono on public.pix_links (dono);

create table if not exists public.pix_acessos (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references public.pix_links(id) on delete cascade,
  em          timestamptz not null default now(),
  dispositivo text, sistema text, cidade text, regiao text
);
create index if not exists pix_acessos_link_em on public.pix_acessos (link_id, em desc);

alter table public.pix_chaves  enable row level security;
alter table public.pix_links   enable row level security;
alter table public.pix_acessos enable row level security;

drop policy if exists "admins pix chaves" on public.pix_chaves;
create policy "admins pix chaves" on public.pix_chaves for all using (public.qr_eh_admin()) with check (public.qr_eh_admin());
drop policy if exists "cliente pix chaves" on public.pix_chaves;
create policy "cliente pix chaves" on public.pix_chaves for all
  using (dono is not null and dono = public.qr_meu_cliente()) with check (dono is not null and dono = public.qr_meu_cliente());

drop policy if exists "admins pix links" on public.pix_links;
create policy "admins pix links" on public.pix_links for all using (public.qr_eh_admin()) with check (public.qr_eh_admin());
drop policy if exists "cliente pix links" on public.pix_links;
create policy "cliente pix links" on public.pix_links for all
  using (dono is not null and dono = public.qr_meu_cliente()) with check (dono is not null and dono = public.qr_meu_cliente());

drop policy if exists "admins pix acessos" on public.pix_acessos;
create policy "admins pix acessos" on public.pix_acessos for select using (public.qr_eh_admin());
drop policy if exists "cliente pix acessos" on public.pix_acessos;
create policy "cliente pix acessos" on public.pix_acessos for select
  using (exists (select 1 from public.pix_links l where l.id = link_id and l.dono is not null and l.dono = public.qr_meu_cliente()));

-- regras do cliente no Pix: limite, dono, contador e chave só dele
create or replace function public.pix_regras_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.qr_clientes; n integer;
begin
  if auth.uid() is null or public.qr_eh_admin() then return new; end if;
  select * into c from public.qr_clientes where user_id = auth.uid() and ativo;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if c.validade is not null and c.validade < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Seu plano venceu em %. Fale com a gente pra renovar.', to_char(c.validade, 'DD/MM/YYYY');
  end if;
  new.dono := c.id;
  if tg_table_name = 'pix_chaves' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtext('pixc' || c.id::text));
      select count(*) into n from public.pix_chaves where dono = c.id;
      if n >= greatest(c.limite_pix, 1) then raise exception 'Limite de % chaves Pix atingido. Fale com a gente pra aumentar.', greatest(c.limite_pix, 1); end if;
      new.criado_por := auth.uid(); new.criado_em := now();
    else
      new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    end if;
    return new;
  end if;
  -- pix_links
  if not exists (select 1 from public.pix_chaves where id = new.chave_id and dono = c.id) then
    raise exception 'Escolha uma das suas chaves Pix.';
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('pixl' || c.id::text));
    select count(*) into n from public.pix_links where dono = c.id;
    if n >= c.limite_pix then raise exception 'Limite de % links Pix atingido. Fale com a gente pra aumentar.', c.limite_pix; end if;
    new.acessos := 0; new.ultimo_acesso := null; new.criado_por := auth.uid(); new.criado_em := now();
  else
    new.acessos := old.acessos; new.ultimo_acesso := old.ultimo_acesso; new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  end if;
  return new;
end $$;
drop trigger if exists pix_chaves_regras on public.pix_chaves;
create trigger pix_chaves_regras before insert or update on public.pix_chaves for each row execute function public.pix_regras_cliente();
drop trigger if exists pix_links_regras on public.pix_links;
create trigger pix_links_regras before insert or update on public.pix_links for each row execute function public.pix_regras_cliente();

-- usada pela página pública /p/nome: devolve os dados pro Pix e conta o acesso
create or replace function public.pix_abrir(
  p_slug text, p_contar boolean default true,
  p_dispositivo text default null, p_sistema text default null, p_cidade text default null, p_regiao text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.pix_links; k public.pix_chaves; c public.qr_clientes; st text;
begin
  select * into l from public.pix_links where slug = lower(trim(p_slug));
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  select * into k from public.pix_chaves where id = l.chave_id;
  if l.dono is not null then select * into c from public.qr_clientes where id = l.dono; end if;
  st := case
    when c.id is not null and not c.ativo then 'inativo'
    when c.id is not null and c.validade is not null and c.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
    when not l.ativo then 'inativo'
    else 'ok' end;
  if p_contar then
    insert into public.pix_acessos (link_id, dispositivo, sistema, cidade, regiao)
    values (l.id, left(p_dispositivo, 20), left(p_sistema, 30), left(p_cidade, 80), left(p_regiao, 60));
    if st = 'ok' then update public.pix_links set acessos = acessos + 1, ultimo_acesso = now() where id = l.id; end if;
  end if;
  if st <> 'ok' then return jsonb_build_object('status', st); end if;
  return jsonb_build_object('status', 'ok', 'titulo', l.titulo, 'valor', l.valor, 'descricao', l.descricao,
    'tipo', k.tipo, 'chave', k.chave, 'nome', k.nome, 'cidade', k.cidade);
end $$;
revoke all on function public.pix_abrir(text, boolean, text, text, text, text) from public;
grant execute on function public.pix_abrir(text, boolean, text, text, text, text) to anon, authenticated;

-- o painel do cliente confere se o nome do link está livre (sem mostrar de quem é)
create or replace function public.pix_slug_livre(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.pix_links where slug = lower(trim(p_slug)))
$$;
grant execute on function public.pix_slug_livre(text) to authenticated;
