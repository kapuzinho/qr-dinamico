-- =====================================================================
-- Kapuzinho 3D — controle de acesso (Supabase / Postgres)
-- Rode inteiro no SQL Editor do Supabase (pode rodar de novo: é idempotente).
-- =====================================================================

-- ---------- configurações gerais ----------
create table if not exists public.config (
  chave text primary key,
  valor jsonb not null
);
insert into public.config (chave, valor) values
  ('limite_padrao', '5'),          -- downloads por usuário novo
  ('sessao_minutos', '3'),         -- sem sinal do navegador por esse tempo = sessão livre
  ('novos_ativos', 'true')         -- quem se cadastra sozinho (e-mail ou Google) já entra liberado? false = espera aprovação
on conflict (chave) do nothing;

-- ---------- usuários (perfil ligado ao login do Supabase Auth) ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nome text,
  papel text not null default 'usuario' check (papel in ('usuario', 'admin')),
  ativo boolean not null default true,
  validade date,                                   -- opcional: acesso até essa data
  limite_downloads integer not null default 5 check (limite_downloads >= 0),
  downloads_usados integer not null default 0 check (downloads_usados >= 0),
  sessao_id uuid,                                  -- sessão ativa (1 por login)
  sessao_visto timestamptz,                        -- último sinal de vida da sessão
  sessao_info text,                                -- navegador/sistema da sessão ativa
  ultimo_login timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.downloads (
  id bigserial primary key,
  usuario uuid not null references public.perfis (id) on delete cascade,
  formato text not null,
  nome text,
  criado_em timestamptz not null default now()
);
create index if not exists downloads_usuario_idx on public.downloads (usuario, criado_em desc);

create table if not exists public.acessos (
  id bigserial primary key,
  usuario uuid references public.perfis (id) on delete cascade,
  evento text not null,            -- login | bloqueado | logout | derrubado | expirou | negado
  info text,
  criado_em timestamptz not null default now()
);
create index if not exists acessos_usuario_idx on public.acessos (usuario, criado_em desc);

-- ---------- segurança: ninguém escreve direto nas tabelas, só pelas funções abaixo ----------
alter table public.config enable row level security;
alter table public.perfis enable row level security;
alter table public.downloads enable row level security;
alter table public.acessos enable row level security;

-- leitura passa pelo RLS; escrita direta é proibida pra quem usa o site (tudo via funções)
revoke insert, update, delete, truncate on public.config, public.perfis, public.downloads, public.acessos from anon, authenticated;
grant select on public.config, public.perfis, public.downloads, public.acessos to authenticated;
revoke all on public.config, public.perfis, public.downloads, public.acessos from anon;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin' and ativo);
$$;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (id = auth.uid() or public.eh_admin());
drop policy if exists downloads_ler on public.downloads;
create policy downloads_ler on public.downloads for select to authenticated using (usuario = auth.uid() or public.eh_admin());
drop policy if exists acessos_ler on public.acessos;
create policy acessos_ler on public.acessos for select to authenticated using (public.eh_admin());
drop policy if exists config_ler on public.config;
create policy config_ler on public.config for select to authenticated using (true);

-- todo usuário criado no Auth ganha um perfil com o limite padrão
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, email, nome, limite_downloads, ativo)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''),
                   nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
          coalesce((select (valor #>> '{}')::int from config where chave = 'limite_padrao'), 5),
          -- criado pelo admin: sempre ativo; cadastro feito pela própria pessoa: segue a configuração
          case when new.raw_user_meta_data ->> 'criado_pelo_admin' = 'sim' then true
               else coalesce((select (valor #>> '{}')::boolean from config where chave = 'novos_ativos'), true) end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_perfil();

create or replace function public.minutos_sessao() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::int from config where chave = 'sessao_minutos'), 3);
$$;

-- checa se a conta pode usar o sistema agora (ativa e dentro da validade)
create or replace function public.checar_conta(p perfis) returns void
language plpgsql as $$
begin
  if p.id is null then raise exception 'CONTA_INEXISTENTE' using hint = 'Conta sem perfil.'; end if;
  if not p.ativo then
    if p.ultimo_login is null then raise exception 'CONTA_INATIVA' using hint = 'Cadastro recebido! Seu acesso ainda vai ser liberado pelo administrador.'; end if;
    raise exception 'CONTA_INATIVA' using hint = 'Seu acesso está desativado. Fale com o administrador.';
  end if;
  if p.validade is not null and p.validade < current_date then raise exception 'CONTA_VENCIDA' using hint = 'Seu acesso venceu. Fale com o administrador.'; end if;
end $$;

-- ---------- sessão única por login ----------
-- Abre a sessão deste navegador. Se já existe outra sessão viva (outro computador), NÃO deixa entrar.
create or replace function public.iniciar_sessao(p_info text default null, p_sessao_atual uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare p perfis; nova uuid;
begin
  select * into p from perfis where id = auth.uid() for update;
  perform checar_conta(p);
  -- o mesmo navegador recarregando a página continua com a mesma sessão
  if p_sessao_atual is not null and p.sessao_id = p_sessao_atual then
    update perfis set sessao_visto = now() where id = p.id;
    return json_build_object('sessao', p.sessao_id, 'nome', p.nome, 'papel', p.papel,
      'restantes', greatest(p.limite_downloads - p.downloads_usados, 0), 'limite', p.limite_downloads);
  end if;
  if p.sessao_id is not null and p.sessao_visto > now() - make_interval(mins => minutos_sessao()) then
    insert into acessos (usuario, evento, info) values (p.id, 'bloqueado', left(p_info, 300));
    raise exception 'SESSAO_ATIVA' using hint = 'Essa conta já está aberta em outro computador/navegador. Saia de lá (botão Sair) ou espere alguns minutos depois de fechar.';
  end if;
  nova := gen_random_uuid();
  update perfis set sessao_id = nova, sessao_visto = now(), sessao_info = left(p_info, 300), ultimo_login = now() where id = p.id;
  insert into acessos (usuario, evento, info) values (p.id, 'login', left(p_info, 300));
  return json_build_object('sessao', nova, 'nome', p.nome, 'papel', p.papel,
    'restantes', greatest(p.limite_downloads - p.downloads_usados, 0), 'limite', p.limite_downloads);
end $$;

-- sinal de vida (o site chama a cada minuto). ok=false: sessão não vale mais (derrubada, outra entrou, conta desativada)
create or replace function public.pulso(p_sessao uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p perfis;
begin
  select * into p from perfis where id = auth.uid();
  if p.id is null or not p.ativo or (p.validade is not null and p.validade < current_date) or p.sessao_id is distinct from p_sessao then
    return json_build_object('ok', false);
  end if;
  update perfis set sessao_visto = now() where id = p.id;
  return json_build_object('ok', true, 'restantes', greatest(p.limite_downloads - p.downloads_usados, 0), 'limite', p.limite_downloads);
end $$;

create or replace function public.encerrar_sessao(p_sessao uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update perfis set sessao_id = null, sessao_visto = null, sessao_info = null where id = auth.uid() and sessao_id = p_sessao;
  if found then insert into acessos (usuario, evento) values (auth.uid(), 'logout'); end if;
end $$;

-- ---------- downloads com limite (chamada pela Edge Function "exportar", antes de entregar o arquivo) ----------
create or replace function public.consumir_download(p_sessao uuid, p_formato text, p_nome text)
returns json language plpgsql security definer set search_path = public as $$
declare p perfis;
begin
  select * into p from perfis where id = auth.uid() for update;     -- trava a linha: 2 cliques ao mesmo tempo não furam o limite
  perform checar_conta(p);
  if p.sessao_id is distinct from p_sessao or p.sessao_visto < now() - make_interval(mins => minutos_sessao()) then
    insert into acessos (usuario, evento, info) values (p.id, 'negado', 'download com sessão inválida');
    raise exception 'SESSAO_INVALIDA' using hint = 'Sua sessão expirou ou foi aberta em outro lugar. Entre de novo.';
  end if;
  if p.downloads_usados >= p.limite_downloads then
    raise exception 'LIMITE' using hint = 'Você atingiu o limite de downloads. Fale com o administrador pra liberar mais.';
  end if;
  update perfis set downloads_usados = downloads_usados + 1, sessao_visto = now() where id = p.id;
  insert into downloads (usuario, formato, nome) values (p.id, left(p_formato, 10), left(p_nome, 150));
  return json_build_object('restantes', p.limite_downloads - p.downloads_usados - 1, 'limite', p.limite_downloads);
end $$;

-- ---------- administração (só admin) ----------
create or replace function public.exigir_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_admin() then raise exception 'SEM_PERMISSAO' using hint = 'Só administradores.'; end if;
end $$;

create or replace function public.admin_listar()
returns table (id uuid, email text, nome text, papel text, ativo boolean, validade date, limite_downloads int,
               downloads_usados int, online boolean, sessao_info text, sessao_visto timestamptz, ultimo_login timestamptz, criado_em timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query select p.id, p.email, p.nome, p.papel, p.ativo, p.validade, p.limite_downloads, p.downloads_usados,
    (p.sessao_id is not null and p.sessao_visto > now() - make_interval(mins => minutos_sessao())),
    p.sessao_info, p.sessao_visto, p.ultimo_login, p.criado_em
  from perfis p order by p.criado_em desc;
end $$;

create or replace function public.admin_atualizar(p_id uuid, p_nome text, p_papel text, p_ativo boolean, p_limite int, p_validade date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  if p_id = auth.uid() and (p_papel <> 'admin' or not p_ativo) then
    raise exception 'PROPRIO_ADMIN' using hint = 'Você não pode tirar o seu próprio acesso de administrador.';
  end if;
  update perfis set nome = p_nome, papel = p_papel, ativo = p_ativo, limite_downloads = greatest(p_limite, 0), validade = p_validade where id = p_id;
  -- desativou: derruba a sessão na hora
  if not p_ativo then update perfis set sessao_id = null, sessao_visto = null where id = p_id; end if;
end $$;

create or replace function public.admin_zerar_downloads(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  update perfis set downloads_usados = 0 where id = p_id;
end $$;

create or replace function public.admin_derrubar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  update perfis set sessao_id = null, sessao_visto = null, sessao_info = null where id = p_id;
  insert into acessos (usuario, evento, info) values (p_id, 'derrubado', 'pelo administrador');
end $$;

drop function if exists public.admin_config(int, int, boolean);
create or replace function public.admin_config(p_limite_padrao int, p_sessao_minutos int, p_aplicar_todos boolean default false, p_novos_ativos boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  insert into config values ('novos_ativos', to_jsonb(p_novos_ativos)) on conflict (chave) do update set valor = excluded.valor;
  insert into config values ('limite_padrao', to_jsonb(greatest(p_limite_padrao, 0))) on conflict (chave) do update set valor = excluded.valor;
  insert into config values ('sessao_minutos', to_jsonb(greatest(p_sessao_minutos, 1))) on conflict (chave) do update set valor = excluded.valor;
  if p_aplicar_todos then update perfis set limite_downloads = greatest(p_limite_padrao, 0) where papel = 'usuario'; end if;
end $$;

create or replace function public.admin_historico(p_id uuid default null, p_limite int default 200)
returns table (quando timestamptz, usuario uuid, email text, tipo text, detalhe text)
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select * from (
      select d.criado_em, d.usuario, p.email, ('download ' || d.formato)::text, d.nome from downloads d join perfis p on p.id = d.usuario
       where p_id is null or d.usuario = p_id
      union all
      select a.criado_em, a.usuario, p.email, a.evento, a.info from acessos a left join perfis p on p.id = a.usuario
       where p_id is null or a.usuario = p_id
    ) h order by 1 desc limit least(p_limite, 1000);
end $$;

-- quem pode chamar o quê (usuário anônimo não chama nada)
revoke all on function public.iniciar_sessao(text, uuid), public.pulso(uuid), public.encerrar_sessao(uuid),
  public.consumir_download(uuid, text, text), public.admin_listar(), public.admin_atualizar(uuid, text, text, boolean, int, date),
  public.admin_zerar_downloads(uuid), public.admin_derrubar(uuid), public.admin_config(int, int, boolean, boolean),
  public.admin_historico(uuid, int), public.eh_admin(), public.checar_conta(perfis), public.exigir_admin(), public.minutos_sessao() from public, anon;
grant execute on function public.iniciar_sessao(text, uuid), public.pulso(uuid), public.encerrar_sessao(uuid),
  public.consumir_download(uuid, text, text), public.admin_listar(), public.admin_atualizar(uuid, text, text, boolean, int, date),
  public.admin_zerar_downloads(uuid), public.admin_derrubar(uuid), public.admin_config(int, int, boolean, boolean),
  public.admin_historico(uuid, int), public.eh_admin() to authenticated;

-- =====================================================================
-- PRIMEIRO ADMINISTRADOR: crie seu usuário em Authentication > Users (Add user)
-- e depois rode (trocando o e-mail):
--   update public.perfis set papel = 'admin', limite_downloads = 100000 where email = 'seu@email.com';
-- =====================================================================
