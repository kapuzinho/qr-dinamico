// QR Dinâmico — painel (sem build: HTML + JS puro).
// Dados no Supabase (ou no navegador, em modo demonstração).
(() => {
'use strict';
const CFG = window.QR_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
const BASE = (CFG.DOMINIO || location.origin).replace(/\/$/, '');
const MARCA = CFG.MARCA || 'Kapuzinho 3D';
const ALFABETO = '23456789abcdefghjkmnpqrstuvwxyz';          // sem 0/o/1/l/i (não confunde)
const app = document.getElementById('app');

// ---------------- utilidades ----------------
function h(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return e;
}
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });       // AAAA-MM-DD (Brasília)
const somaDias = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const somaMeses = (iso, m) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + m); return t.toISOString().slice(0, 10); };
const diasAte = iso => Math.round((new Date(iso + 'T12:00:00Z') - new Date(hoje() + 'T12:00:00Z')) / 864e5);
const dataBR = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const dataHora = ts => new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const linkCurto = l => `${BASE}/${l.codigo}`;
const novoCodigo = (n = 6) => { const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a].map(x => ALFABETO[x % ALFABETO.length]).join(''); };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const normUrl = u => { u = (u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u; };
const urlValida = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && !!x.hostname.includes('.'); } catch { return false; } };
const limpo = k => k.flat().filter(x => x != null && x !== false);
const add = (el, ...k) => el.append(...limpo(k));
const rep = (el, ...k) => el.replaceChildren(...limpo(k));
function aviso(msg, erro = false) {
  document.querySelector('.aviso')?.remove();
  const a = h('div', { class: 'aviso' + (erro ? ' erro' : ''), text: msg }); document.body.append(a);
  setTimeout(() => a.remove(), erro ? 5000 : 2600);
}
async function copiar(t) {
  try { await navigator.clipboard.writeText(t); }
  catch { const x = h('textarea', { text: t }); document.body.append(x); x.select(); document.execCommand('copy'); x.remove(); }
  aviso('Copiado: ' + t);
}
function baixar(blob, nome) { const a = h('a', { href: URL.createObjectURL(blob), download: nome }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const nomeArquivo = s => (s || 'qr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'qr';

// status de um link (igual ao do redirecionamento)
function status(l) {
  if (!l.ativo) return 'inativo';
  if (l.validade && l.validade < hoje()) return 'vencido';
  if (!l.destino) return 'sem_destino';
  if (l.validade && diasAte(l.validade) <= 7) return 'avencer';
  return 'ok';
}
const ROTULO = { ok: 'Ativo', avencer: 'Vence logo', vencido: 'Vencido', inativo: 'Desativado', sem_destino: 'Sem destino' };
function selo(l) {
  const s = status(l);
  let t = ROTULO[s];
  if (s === 'avencer') { const d = diasAte(l.validade); t = d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d > 1 ? 's' : ''}`; }
  return h('span', { class: 'selo ' + s, text: t });
}

// ---------------- QR ----------------
function matrizQR(texto) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  const n = q.getModuleCount();
  return { n, escuro: (r, c) => q.isDark(r, c) };
}
function desenharQR(canvas, texto, { tam = 1024, margem = 4, frente = '#000000', fundo = '#ffffff' } = {}) {
  const m = matrizQR(texto), tot = m.n + margem * 2, px = Math.max(1, Math.floor(tam / tot)), lado = px * tot;
  canvas.width = canvas.height = lado;
  const g = canvas.getContext('2d');
  g.fillStyle = fundo; g.fillRect(0, 0, lado, lado); g.fillStyle = frente;
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.escuro(r, c)) g.fillRect((c + margem) * px, (r + margem) * px, px, px);
  return canvas;
}
function svgQR(texto, { margem = 4, frente = '#000000', fundo = '#ffffff' } = {}) {
  const m = matrizQR(texto), tot = m.n + margem * 2; let d = '';
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.escuro(r, c)) d += `M${c + margem} ${r + margem}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" shape-rendering="crispEdges"><rect width="${tot}" height="${tot}" fill="${fundo}"/><path fill="${frente}" d="${d}"/></svg>`;
}
const pngQR = (texto, o) => new Promise(r => desenharQR(document.createElement('canvas'), texto, o).toBlob(r, 'image/png'));

// ---------------- dados ----------------
function dadosDemo() {
  const K = 'qr-dinamico-demo';
  const ler = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch { return null; } };
  const gravar = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  let db = ler();
  if (!db) {
    const agora = Date.now(), dia = 864e5, h0 = hoje();
    const ex = (codigo, nome, cliente, destino, validade, ativo = true) => ({ id: uuid(), codigo, nome, cliente, telefone: '', observacao: '', destino, validade, ativo, destino_vencido: null, cliques: 0, ultimo_clique: null, criado_em: new Date(agora - 40 * dia).toISOString(), atualizado_em: new Date(agora - 40 * dia).toISOString() });
    const links = [
      ex('rb7k2m', 'Placa Google – Barbearia RB', 'Barbearia RB', 'https://g.page/r/exemplo-rb/review', somaMeses(h0, 11)),
      ex('pz4h8q', 'Placa Wi-Fi + Instagram – Pizzaria Bella', 'Pizzaria Bella', 'https://instagram.com/pizzariabella', somaDias(h0, 5)),
      ex('ct9w3x', 'Cardápio – Café Central', 'Café Central', 'https://cafecentral.com.br/cardapio', somaDias(h0, -3)),
      ex('es2n6v', 'Placa Google 004 (estoque)', '', '', null),
    ];
    const cliques = [];
    const disp = ['celular', 'celular', 'celular', 'tablet', 'computador'], sis = ['Android', 'Android', 'iPhone/iPad', 'iPhone/iPad', 'Windows'], cid = ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Guará'];
    links.slice(0, 3).forEach((l, k) => {
      const n = [140, 60, 35][k];
      for (let i = 0; i < n; i++) {
        const em = new Date(agora - Math.random() * 38 * dia), ok = !(k === 2 && em > new Date(agora - 3 * dia));
        cliques.push({ id: cliques.length + 1, link_id: l.id, em: em.toISOString(), resultado: ok ? 'ok' : 'vencido', dispositivo: disp[i % 5], sistema: sis[(i * 7) % 5], navegador: i % 3 ? 'Chrome' : 'Safari', pais: 'BR', regiao: 'DF', cidade: cid[(i * 3) % 5], origem: null });
        if (ok) { l.cliques++; if (!l.ultimo_clique || em.toISOString() > l.ultimo_clique) l.ultimo_clique = em.toISOString(); }
      }
    });
    db = { links, cliques }; gravar(db);
  }
  return {
    async sessao() { return { email: 'demonstração' }; },
    async listar() { return structuredClone(db.links); },
    async salvar(l) {
      if (!/^[a-z0-9_-]{3,32}$/.test(l.codigo)) throw new Error('Código inválido.');
      if (db.links.some(x => x.codigo === l.codigo && x.id !== l.id)) throw new Error('Esse código já existe.');
      const agora = new Date().toISOString();
      if (l.id) { const i = db.links.findIndex(x => x.id === l.id); db.links[i] = { ...db.links[i], ...l, atualizado_em: agora }; gravar(db); return structuredClone(db.links[i]); }
      const n = { cliques: 0, ultimo_clique: null, ...l, id: uuid(), criado_em: agora, atualizado_em: agora }; db.links.push(n); gravar(db); return structuredClone(n);
    },
    async apagar(id) { db.links = db.links.filter(x => x.id !== id); db.cliques = db.cliques.filter(c => c.link_id !== id); gravar(db); },
    async zerar(id) { db.cliques = db.cliques.filter(c => c.link_id !== id); const l = db.links.find(x => x.id === id); l.cliques = 0; l.ultimo_clique = null; gravar(db); },
    async cliques(id, dias) { const d = Date.now() - dias * 864e5; return db.cliques.filter(c => (!id || c.link_id === id) && new Date(c.em) >= d).sort((a, b) => b.em.localeCompare(a.em)); },
    async simular(l) {                     // simula a leitura do QR (só no modo demonstração)
      const st = status(l) === 'avencer' ? 'ok' : status(l);
      db.cliques.push({ id: db.cliques.length + 1, link_id: l.id, em: new Date().toISOString(), resultado: st, dispositivo: 'celular', sistema: 'Android', navegador: 'Chrome', pais: 'BR', regiao: 'DF', cidade: 'Brasília', origem: null });
      const x = db.links.find(y => y.id === l.id); if (st === 'ok') { x.cliques++; x.ultimo_clique = new Date().toISOString(); }
      gravar(db); return st;
    },
    async sair() { },
  };
}

function dadosSupabase() {
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(traduzErro(error)); return data; };
  const traduzErro = e => {
    const m = e.message || String(e);
    if (/duplicate key|qr_links_codigo_key/i.test(m)) return 'Esse código já existe. Escolha outro.';
    if (/row-level security|permission denied/i.test(m)) return 'Sem permissão: seu usuário não está liberado como admin (veja o LEIA-ME).';
    if (/check constraint/i.test(m)) return 'Algum campo está num formato inválido (código ou link).';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado (confirme no Supabase → Authentication → Users).';
    if (/load failed|failed to fetch|networkerror/i.test(m)) return 'Sem conexão com o Supabase. Confira a internet e o config.js.';
    return m;
  };
  const CAMPOS = ['codigo', 'nome', 'cliente', 'telefone', 'observacao', 'destino', 'validade', 'ativo', 'destino_vencido'];
  return {
    sb,
    async sessao() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const adm = await sb.from('qr_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
      return { email: data.session.user.email, admin: !!adm.data };
    },
    async entrar(email, senha) { ok(await sb.auth.signInWithPassword({ email, password: senha })); },
    async sair() { await sb.auth.signOut(); },
    async listar() {
      const todos = []; let de = 0;
      for (;;) {                            // pagina de 1000 em 1000
        const d = ok(await sb.from('qr_links').select('*').order('criado_em', { ascending: false }).range(de, de + 999));
        todos.push(...d); if (d.length < 1000) break; de += 1000;
      }
      return todos;
    },
    async salvar(l) {
      const dados = Object.fromEntries(CAMPOS.map(k => [k, l[k] === '' ? null : l[k]]));
      dados.nome = l.nome; dados.ativo = !!l.ativo;
      if (l.id) return ok(await sb.from('qr_links').update(dados).eq('id', l.id).select().single());
      return ok(await sb.from('qr_links').insert(dados).select().single());
    },
    async apagar(id) { ok(await sb.from('qr_links').delete().eq('id', id)); },
    async zerar(id) { ok(await sb.from('qr_cliques').delete().eq('link_id', id)); ok(await sb.from('qr_links').update({ cliques: 0, ultimo_clique: null }).eq('id', id)); },
    async cliques(id, dias) {
      const desde = new Date(Date.now() - dias * 864e5).toISOString(), todos = []; let de = 0;
      for (;;) {
        let q = sb.from('qr_cliques').select('link_id,em,resultado,dispositivo,sistema,navegador,cidade,regiao,pais').gte('em', desde).order('em', { ascending: false }).range(de, de + 999);
        if (id) q = q.eq('link_id', id);
        const d = ok(await q); todos.push(...d); if (d.length < 1000 || todos.length >= 20000) break; de += 1000;
      }
      return todos;
    },
  };
}

const D = DEMO ? dadosDemo() : dadosSupabase();
let LINKS = [], filtro = { busca: '', tipo: 'todos', ordem: 'recentes' }, CLIQUES30 = [];

// ---------------- telas ----------------
async function iniciar() {
  if (DEMO) return montarPainel({ email: 'demonstração' });
  const s = await D.sessao().catch(() => null);
  if (!s) return telaLogin();
  if (!s.admin) return telaLogin('Este usuário entrou, mas não está liberado como admin. Rode o comando do LEIA-ME (qr_admins) com o seu e-mail.');
  montarPainel(s);
}

function telaLogin(msg = '') {
  app.innerHTML = '';
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const erro = h('p', { class: 'erro-msg', text: msg });
  const btn = h('button', { class: 'btn primario', type: 'submit', text: 'Entrar' });
  const f = h('form', { class: 'caixa-login', onsubmit: async e => {
    e.preventDefault(); erro.textContent = ''; btn.disabled = true;
    try { await D.entrar(email.value.trim(), senha.value); await iniciar(); }
    catch (x) { erro.textContent = x.message; }
    finally { btn.disabled = false; }
  } },
  h('h1', { text: 'QR Dinâmico' }), h('p', { text: `Painel de links e QR Codes · ${MARCA}` }),
  h('label', { class: 'campo' }, h('span', { text: 'E-mail' }), email),
  h('label', { class: 'campo' }, h('span', { text: 'Senha' }), senha), erro, btn);
  add(app, h('div', { class: 'tela-login' }, f));
  email.focus();
}

function montarPainel(sessao) {
  app.innerHTML = '';
  const logo = h('div', { class: 'logo-qr' }); logo.innerHTML = '<svg viewBox="0 0 32 32" width="22" height="22"><path fill="#fff" d="M5 5h9v9H5zm2 2v5h5V7zm11-2h9v9h-9zm2 2v5h5V7zM5 18h9v9H5zm2 2v5h5v-5zm11-2h3v3h-3zm5 0h4v4h-4zm-5 5h4v4h-4zm6 2h3v2h-3z"/></svg>';
  add(app, 
    h('header', { class: 'topo' },
      h('div', { class: 'marca' }, logo, h('div', {}, 'QR Dinâmico', h('small', { text: MARCA }))),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn primario', text: '+ Novo QR', onclick: () => abrirLink(null) }),
        h('button', { class: 'btn', text: 'Criar em lote', onclick: abrirLote }),
        h('button', { class: 'btn', text: 'Exportar CSV', onclick: exportarCSV }),
        DEMO ? h('button', { class: 'btn', text: 'Zerar demonstração', onclick: () => { if (confirm('Apagar os dados da demonstração e recomeçar?')) { localStorage.removeItem('qr-dinamico-demo'); location.reload(); } } })
          : h('button', { class: 'btn', text: 'Sair', title: sessao.email, onclick: async () => { await D.sair(); telaLogin(); } }))),
    DEMO ? h('div', { class: 'demo', text: 'Modo demonstração: os dados ficam só neste navegador e o link curto não redireciona de verdade (use "Simular leitura"). Preencha o config.js com o Supabase pra usar pra valer.' }) : null,
    h('main', {}, h('section', { class: 'cards', id: 'cards' }), barraBusca(), h('section', { class: 'lista', id: 'lista' })),
  );
  recarregar();
}

function barraBusca() {
  const busca = h('input', { type: 'search', placeholder: 'Procurar por nome, cliente, código ou link…', value: filtro.busca, oninput: e => { filtro.busca = e.target.value; desenharLista(); } });
  const tipo = h('select', { onchange: e => { filtro.tipo = e.target.value; desenharLista(); } },
    ...[['todos', 'Todos'], ['ativos', 'Ativos'], ['avencer', 'Vencem em 30 dias'], ['vencidos', 'Vencidos'], ['sem_destino', 'Sem destino (estoque)'], ['inativos', 'Desativados']].map(([v, t]) => h('option', { value: v, text: t })));
  const ordem = h('select', { onchange: e => { filtro.ordem = e.target.value; desenharLista(); } },
    ...[['recentes', 'Mais recentes'], ['cliques', 'Mais cliques'], ['validade', 'Validade mais próxima'], ['nome', 'Nome (A-Z)']].map(([v, t]) => h('option', { value: v, text: t })));
  tipo.value = filtro.tipo; ordem.value = filtro.ordem;
  return h('div', { class: 'barra' }, busca, tipo, ordem);
}

async function recarregar() {
  try {
    [LINKS, CLIQUES30] = await Promise.all([D.listar(), D.cliques(null, 30)]);
  } catch (e) { aviso(e.message, true); LINKS = LINKS || []; }
  desenharCards(); desenharLista();
}

function desenharCards() {
  const c = document.getElementById('cards'); if (!c) return;
  const st = LINKS.map(status);
  const ativos = st.filter(s => s === 'ok' || s === 'avencer').length;
  const venc = st.filter(s => s === 'vencido').length;
  const av = LINKS.filter(l => l.ativo && l.validade && l.validade >= hoje() && diasAte(l.validade) <= 30).length;
  const cl = CLIQUES30.filter(x => x.resultado === 'ok').length;
  const card = (n, r, tipo, cls = '') => h('div', { class: 'card ' + cls, onclick: () => { if (tipo) { filtro.tipo = tipo; document.querySelector('.barra select').value = tipo; desenharLista(); } } }, h('div', { class: 'n', text: n }), h('div', { class: 'r', text: r }));
  rep(c, card(LINKS.length, 'QR Codes', 'todos'), card(ativos, 'Ativos', 'ativos'), card(av, 'Vencem em 30 dias', 'avencer', av ? 'alerta' : ''),
    card(venc, 'Vencidos', 'vencidos', venc ? 'erro' : ''), card(cl, 'Leituras nos últimos 30 dias', null));
}

function filtrados() {
  const b = filtro.busca.trim().toLowerCase();
  let l = LINKS.filter(x => !b || [x.nome, x.cliente, x.codigo, x.destino, x.telefone, x.observacao].some(v => (v || '').toLowerCase().includes(b)));
  const t = filtro.tipo;
  l = l.filter(x => {
    const s = status(x);
    if (t === 'ativos') return s === 'ok' || s === 'avencer';
    if (t === 'vencidos') return s === 'vencido';
    if (t === 'inativos') return s === 'inativo';
    if (t === 'sem_destino') return s === 'sem_destino';
    if (t === 'avencer') return x.ativo && x.validade && x.validade >= hoje() && diasAte(x.validade) <= 30;
    return true;
  });
  const o = filtro.ordem;
  l.sort((a, b2) => o === 'cliques' ? b2.cliques - a.cliques
    : o === 'validade' ? (a.validade || '9999').localeCompare(b2.validade || '9999')
    : o === 'nome' ? a.nome.localeCompare(b2.nome, 'pt-BR')
    : b2.criado_em.localeCompare(a.criado_em));
  return l;
}

function desenharLista() {
  const box = document.getElementById('lista'); if (!box) return;
  const l = filtrados();
  const cab = h('div', { class: 'linha cab' }, h('div', { text: 'Nome / cliente' }), h('div', { text: 'Link curto' }), h('div', { text: 'Destino' }), h('div', { text: 'Validade' }), h('div', { class: 'num', text: 'Cliques' }), h('div', { text: 'Situação' }));
  if (!l.length) {
    rep(box, cab, h('div', { class: 'vazio', text: LINKS.length ? 'Nada encontrado com esse filtro.' : 'Nenhum QR ainda. Clique em "+ Novo QR" ou "Criar em lote".' }));
    return;
  }
  rep(box, cab, ...l.map(x => h('div', { class: 'linha', onclick: () => abrirLink(x) },
    h('div', {}, h('div', { class: 'nome', text: x.nome }), h('div', { class: 'sub', text: x.cliente || '—' })),
    h('div', { class: 'cod' }, h('span', { text: '/' + x.codigo }), h('button', { class: 'btn mini', text: 'Copiar', title: linkCurto(x), onclick: e => { e.stopPropagation(); copiar(linkCurto(x)); } })),
    h('div', { class: 'dest', text: x.destino || 'sem destino', title: x.destino || '' }),
    h('div', { class: 'sub', text: x.validade ? dataBR(x.validade) : 'Sem validade' }),
    h('div', { class: 'num', text: x.cliques }),
    h('div', {}, selo(x)))));
}

// ---------------- janela de um link ----------------
function abrirLink(link) {
  const novo = !link;
  const l = link ? { ...link } : { codigo: novoCodigo(), nome: '', cliente: '', telefone: '', observacao: '', destino: '', validade: somaMeses(hoje(), 12), ativo: true, destino_vencido: '' };
  const titulo = h('h2', { text: novo ? 'Novo QR Code' : l.nome });
  const corpo = h('div', { class: 'lat-corpo' }), rodape = h('div', { class: 'lat-rodape' });
  const abas = h('div', { class: 'abas' });
  const veu = h('div', { class: 'veu', onclick: e => { if (e.target === veu) fechar(); } });
  const fechar = () => { veu.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', esc);
  const mostrar = qual => {
    abas.querySelectorAll('button').forEach(b => b.classList.toggle('ativa', b.dataset.a === qual));
    rep(corpo, ); rep(rodape, );
    ({ dados: abaDados, qr: abaQR, cliques: abaCliques })[qual](l, corpo, rodape, { novo, fechar, titulo, mostrar });
  };
  for (const [a, t] of [['dados', 'Dados'], ['qr', 'QR Code'], ['cliques', 'Cliques']]) abas.append(h('button', { 'data-a': a, text: t, disabled: novo && a !== 'dados', onclick: () => mostrar(a) }));
  veu.append(h('aside', { class: 'lateral' }, h('div', { class: 'lat-topo' }, titulo, h('button', { class: 'fechar', text: '×', title: 'Fechar', onclick: fechar })), abas, corpo, rodape));
  document.body.append(veu);
  mostrar('dados');
}

function campo(rot, el, dica) { return h('label', { class: 'campo' }, h('span', { text: rot }), el, dica ? h('small', { text: dica }) : null); }

function abaDados(l, corpo, rodape, ctx) {
  const nome = h('input', { value: l.nome || '', placeholder: 'Ex.: Placa Google – Barbearia RB', maxlength: 120 });
  const cliente = h('input', { value: l.cliente || '', placeholder: 'Nome do cliente / empresa' });
  const tel = h('input', { value: l.telefone || '', placeholder: '(61) 9 0000-0000', inputmode: 'tel' });
  const destino = h('input', { value: l.destino || '', placeholder: 'https://… (vazio = QR ainda não ativado)', inputmode: 'url' });
  const validade = h('input', { type: 'date', value: l.validade || '' });
  const ativo = h('input', { type: 'checkbox', checked: !!l.ativo });
  const destVenc = h('input', { value: l.destino_vencido || '', placeholder: 'Opcional: https://… (vazio = mostra "QR expirou")', inputmode: 'url' });
  const obs = h('textarea', { placeholder: 'Anotações (cor da placa, valor, forma de pagamento…)' }); obs.value = l.observacao || '';
  const codigo = h('input', { value: l.codigo, maxlength: 32, readOnly: !ctx.novo, style: 'font-family:ui-monospace,Consolas,monospace' });
  const erro = h('p', { class: 'erro-msg' });

  // ajudante de WhatsApp
  const wNum = h('input', { placeholder: 'DDD + número', inputmode: 'tel' }), wMsg = h('input', { placeholder: 'Mensagem (opcional)' });
  const ajudaW = h('div', { class: 'caixa-info', hidden: true },
    h('div', { class: 'duas' }, campo('WhatsApp', wNum), campo('Mensagem', wMsg)),
    h('button', { class: 'btn mini', type: 'button', text: 'Usar como destino', onclick: () => {
      const n = wNum.value.replace(/\D/g, ''); if (n.length < 10) return aviso('Digite DDD + número.', true);
      destino.value = `https://wa.me/${n.length <= 11 ? '55' + n : n}${wMsg.value.trim() ? '?text=' + encodeURIComponent(wMsg.value.trim()) : ''}`; ajudaW.hidden = true;
    } }));
  const rapVal = h('div', { class: 'rapidos' },
    ...[['+30 dias', () => somaDias(base(), 30)], ['+6 meses', () => somaMeses(base(), 6)], ['+1 ano', () => somaMeses(base(), 12)], ['Sem validade', () => '']]
      .map(([t, f]) => h('button', { class: 'btn mini', type: 'button', text: t, onclick: () => { validade.value = f(); } })));
  const base = () => (validade.value && validade.value > hoje() ? validade.value : hoje());   // renovar soma a partir da validade atual

  const st = status(l);
  add(corpo, 
    st === 'vencido' ? h('div', { class: 'caixa-info alerta', text: `Este QR venceu em ${dataBR(l.validade)}. Quem escaneia vê a página "QR expirou". Renove a validade abaixo e salve.` }) : null,
    st === 'sem_destino' && !ctx.novo ? h('div', { class: 'caixa-info', text: 'QR sem destino (estoque): quem escanear vê "QR ainda não ativado". Na venda, coloque o link do cliente e salve.' }) : null,
    campo('Nome / identificação *', nome),
    h('div', { class: 'duas' }, campo('Cliente', cliente), campo('Telefone do cliente', tel)),
    campo('Link de destino', destino, 'Pode trocar quando quiser: o QR impresso continua o mesmo.'),
    h('div', { class: 'rapidos', style: 'margin:-6px 0 14px' }, h('button', { class: 'btn mini', type: 'button', text: 'Montar link do WhatsApp', onclick: () => { ajudaW.hidden = !ajudaW.hidden; } }),
      h('button', { class: 'btn mini', type: 'button', text: 'Testar destino', onclick: () => { const u = normUrl(destino.value); if (urlValida(u)) window.open(u, '_blank', 'noopener'); else aviso('Link inválido.', true); } })),
    ajudaW,
    campo('Válido até', validade, 'Depois dessa data o QR para de redirecionar (vale até o fim do dia).'),
    h('div', { style: 'margin:-6px 0 14px' }, rapVal),
    h('label', { class: 'chave' }, ativo, 'Ativo (desmarque pra pausar o QR na hora)'),
    campo('Depois de vencer, mandar para', destVenc),
    campo('Observações', obs),
    campo('Código do link curto', h('div', { class: 'juntos' }, codigo, ctx.novo ? h('button', { class: 'btn', type: 'button', text: 'Gerar outro', onclick: () => { codigo.value = novoCodigo(); } }) : null),
      ctx.novo ? `Vai ficar ${BASE}/código. Depois de salvo não muda (o QR impresso usa ele).` : `${BASE}/${l.codigo}`),
    erro);

  const salvar = h('button', { class: 'btn primario', text: ctx.novo ? 'Criar QR' : 'Salvar', onclick: async () => {
    erro.textContent = '';
    const d = { ...l, nome: nome.value.trim(), cliente: cliente.value.trim(), telefone: tel.value.trim(), observacao: obs.value.trim(),
      destino: normUrl(destino.value), validade: validade.value || null, ativo: ativo.checked, destino_vencido: normUrl(destVenc.value), codigo: codigo.value.trim().toLowerCase() };
    if (!d.nome) return (erro.textContent = 'Dê um nome pra identificar o QR.');
    if (d.destino && !urlValida(d.destino)) return (erro.textContent = 'O link de destino não parece válido.');
    if (d.destino_vencido && !urlValida(d.destino_vencido)) return (erro.textContent = 'O link "depois de vencer" não parece válido.');
    if (!/^[a-z0-9_-]{3,32}$/.test(d.codigo)) return (erro.textContent = 'Código: 3 a 32 letras minúsculas, números, - ou _.');
    salvar.disabled = true;
    try {
      const r = await D.salvar(d);
      Object.assign(l, r);
      aviso(ctx.novo ? 'QR criado!' : 'Salvo!');
      await recarregar();
      if (ctx.novo) { ctx.fechar(); abrirLink(LINKS.find(x => x.id === r.id) || r); setTimeout(() => document.querySelector('.abas [data-a=qr]')?.click(), 0); }
      else { ctx.titulo.textContent = l.nome; ctx.mostrar('dados'); }
    } catch (e) { erro.textContent = e.message; }
    finally { salvar.disabled = false; }
  } });
  add(rodape, salvar);
  if (!ctx.novo) {
    add(rodape, h('button', { class: 'btn', text: 'Duplicar', title: 'Cria outro QR com os mesmos dados e código novo', onclick: () => { ctx.fechar(); abrirLink(null); setTimeout(() => preencherDuplicado(l), 0); } }));
    if (DEMO) add(rodape, h('button', { class: 'btn', text: 'Simular leitura', onclick: async () => {
      const r = await D.simular(l); await recarregar(); Object.assign(l, LINKS.find(x => x.id === l.id));
      if (r === 'ok') { aviso('Leitura registrada, abrindo o destino…'); window.open(l.destino, '_blank', 'noopener'); } else aviso('Leitura registrada: ' + ROTULO[r], true);
    } }));
    add(rodape, h('span', { class: 'esp' }), h('button', { class: 'btn perigo', text: 'Apagar', onclick: async () => {
      if (!confirm(`Apagar "${l.nome}"?\n\nO QR impresso vai parar de funcionar e os cliques serão perdidos. Se só quer pausar, desmarque "Ativo".`)) return;
      try { await D.apagar(l.id); aviso('Apagado.'); ctx.fechar(); recarregar(); } catch (e) { aviso(e.message, true); }
    } }));
  }
  nome.focus();
}

function preencherDuplicado(l) {
  const ins = document.querySelectorAll('.lateral .lat-corpo input, .lateral .lat-corpo textarea');
  const [nome, cliente, tel, destino] = ins;
  nome.value = l.nome + ' (cópia)'; cliente.value = l.cliente || ''; tel.value = l.telefone || ''; destino.value = l.destino || '';
}

function abaQR(l, corpo, rodape) {
  const url = linkCurto(l);
  const cv = h('canvas');
  const frente = h('input', { type: 'color', value: '#000000' }), fundo = h('input', { type: 'color', value: '#ffffff' });
  const tam = h('select', {}, ...[[512, '512 px'], [1024, '1024 px'], [2048, '2048 px']].map(([v, t]) => h('option', { value: v, text: t }))); tam.value = '1024';
  const op = () => ({ tam: +tam.value, margem: 4, frente: frente.value, fundo: fundo.value });
  const redesenhar = () => desenharQR(cv, url, { ...op(), tam: 480 });
  [frente, fundo].forEach(i => i.addEventListener('input', redesenhar));
  const m = matrizQR(url);
  add(corpo, h('div', { class: 'qr-area' }, cv, h('div', { class: 'link-curto', text: url }),
    h('div', { class: 'cores' }, h('label', {}, 'Cor ', frente), h('label', {}, 'Fundo ', fundo), h('label', {}, 'Tamanho ', tam))),
    h('div', { class: 'caixa-info', style: 'margin-top:16px' },
      `Esse QR tem ${m.n}×${m.n} quadradinhos. Na placa 3D, cole o link curto acima no campo do link (ex.: Placa Google v2): o QR vai apontar pra cá e você troca o destino quando quiser, sem reimprimir.`),
    status(l) !== 'ok' && status(l) !== 'avencer' ? h('div', { class: 'caixa-info alerta', text: `Situação atual: ${ROTULO[status(l)]}. O QR funciona, mas quem escanear agora não vai pro destino.` }) : null);
  redesenhar();
  add(rodape, 
    h('button', { class: 'btn primario', text: 'Baixar PNG', onclick: async () => baixar(await pngQR(url, op()), `QR-${nomeArquivo(l.nome)}-${l.codigo}.png`) }),
    h('button', { class: 'btn', text: 'Baixar SVG', onclick: () => baixar(new Blob([svgQR(url, op())], { type: 'image/svg+xml' }), `QR-${nomeArquivo(l.nome)}-${l.codigo}.svg`) }),
    h('button', { class: 'btn', text: 'Copiar link', onclick: () => copiar(url) }),
    h('button', { class: 'btn', text: 'Abrir', onclick: () => window.open(url, '_blank', 'noopener') }));
}

async function abaCliques(l, corpo, rodape) {
  add(corpo, h('p', { class: 'sub', text: 'Carregando…' }));
  let rows;
  try { rows = await D.cliques(l.id, 90); } catch (e) { rep(corpo, h('p', { class: 'erro-msg', text: e.message })); return; }
  const ok = rows.filter(r => r.resultado === 'ok');
  const dias30 = ok.filter(r => new Date(r.em) >= Date.now() - 30 * 864e5);
  const depois = rows.filter(r => r.resultado !== 'ok');
  rep(corpo, 
    h('div', { class: 'mini-cards' },
      h('div', {}, h('b', { text: l.cliques }), h('span', { text: 'Leituras no total' })),
      h('div', {}, h('b', { text: dias30.length }), h('span', { text: 'Últimos 30 dias' })),
      h('div', {}, h('b', { text: l.ultimo_clique ? dataHora(l.ultimo_clique) : '—' }), h('span', { text: 'Última leitura' }))),
    depois.length ? h('div', { class: 'caixa-info alerta', text: `${depois.length} leitura(s) nos últimos 90 dias sem redirecionar (QR vencido, pausado ou sem destino). Pode ser hora de renovar!` }) : null,
    h('h3', { text: 'Leituras por dia (30 dias)' }), graficoDias(dias30, 30),
    h('h3', { text: 'Aparelhos (90 dias)' }), barras(ok, 'dispositivo'),
    h('h3', { text: 'Sistema' }), barras(ok, 'sistema'),
    h('h3', { text: 'Cidades' }), barras(ok, 'cidade', 6),
    h('h3', { text: 'Últimas leituras' }),
    rows.length ? h('div', { class: 'ultimos' }, ...rows.slice(0, 25).map(r => h('div', {}, h('time', { text: dataHora(r.em) }),
      h('span', { text: [r.dispositivo, r.sistema, r.cidade].filter(Boolean).join(' · ') }), r.resultado !== 'ok' ? h('span', { class: 'selo ' + r.resultado, text: ROTULO[r.resultado] }) : null)))
      : h('p', { class: 'sub', text: 'Nenhuma leitura ainda.' }));
  add(rodape, h('button', { class: 'btn', text: 'Baixar cliques (CSV)', onclick: () => {
    const lin = [['data', 'resultado', 'dispositivo', 'sistema', 'navegador', 'cidade', 'estado', 'pais'], ...rows.map(r => [dataHora(r.em), r.resultado, r.dispositivo, r.sistema, r.navegador, r.cidade, r.regiao, r.pais])];
    baixar(new Blob(['﻿' + csv(lin)], { type: 'text/csv' }), `cliques-${nomeArquivo(l.nome)}.csv`);
  } }), h('span', { class: 'esp' }), h('button', { class: 'btn perigo', text: 'Zerar contagem', onclick: async () => {
    if (!confirm('Apagar todas as leituras registradas deste QR? (o QR continua funcionando)')) return;
    try { await D.zerar(l.id); await recarregar(); Object.assign(l, LINKS.find(x => x.id === l.id)); aviso('Contagem zerada.'); rep(corpo, ); rep(rodape, ); abaCliques(l, corpo, rodape); } catch (e) { aviso(e.message, true); }
  } }));
}

function graficoDias(rows, n) {
  const cont = new Array(n).fill(0), base = hoje();
  const idx = new Map(); for (let i = 0; i < n; i++) idx.set(somaDias(base, i - n + 1), i);
  for (const r of rows) { const d = new Date(r.em).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); if (idx.has(d)) cont[idx.get(d)]++; }
  const mx = Math.max(1, ...cont), W = 600, H = 140, bw = W / n;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
  cont.forEach((v, i) => {
    const r = document.createElementNS(ns, 'rect'), hh = v ? Math.max(3, (H - 6) * v / mx) : 1.5;
    r.setAttribute('x', i * bw + 2); r.setAttribute('y', H - hh); r.setAttribute('width', bw - 4); r.setAttribute('height', hh); r.setAttribute('rx', 2);
    r.setAttribute('fill', v ? '#0f7c80' : '#dfe6e8');
    const t = document.createElementNS(ns, 'title'); t.textContent = `${dataBR(somaDias(base, i - n + 1))}: ${v}`; r.append(t); svg.append(r);
  });
  return h('div', { class: 'grafico' }, svg, h('div', { class: 'leg' }, h('span', { text: dataBR(somaDias(base, -n + 1)) }), h('span', { text: `máx. ${mx}/dia` }), h('span', { text: 'hoje' })));
}
function barras(rows, k, lim = 5) {
  const c = new Map(); for (const r of rows) { const v = r[k] || 'Não informado'; c.set(v, (c.get(v) || 0) + 1); }
  const l = [...c].sort((a, b) => b[1] - a[1]).slice(0, lim), tot = rows.length || 1;
  if (!l.length) return h('p', { class: 'sub', text: '—' });
  return h('div', { class: 'barras-h' }, ...l.map(([n, v]) => { const i = h('i'); i.style.width = (100 * v / tot).toFixed(1) + '%'; return h('div', { class: 'it' }, h('span', { text: n }), h('div', { class: 'tr' }, i), h('span', { class: 'v', text: Math.round(100 * v / tot) + '%' })); }));
}

// ---------------- lote ----------------
function abrirLote() {
  const nome = h('input', { value: 'Placa Google', placeholder: 'Ex.: Placa Google' });
  const qtd = h('input', { type: 'number', value: 10, min: 1, max: 200 });
  const ini = h('input', { type: 'number', value: proximoNumero('Placa Google'), min: 1 });
  const destino = h('input', { placeholder: 'Opcional (vazio = estoque, ativa na venda)' });
  const validade = h('input', { type: 'date' });
  const erro = h('p', { class: 'erro-msg' });
  const veu = h('div', { class: 'veu centro', onclick: e => { if (e.target === veu) veu.remove(); } });
  nome.addEventListener('input', () => { ini.value = proximoNumero(nome.value); });
  const criar = h('button', { class: 'btn primario', text: 'Criar QRs', onclick: async () => {
    erro.textContent = '';
    const n = Math.max(1, Math.min(200, +qtd.value | 0)), i0 = Math.max(1, +ini.value | 0), dest = normUrl(destino.value);
    if (!nome.value.trim()) return (erro.textContent = 'Dê um nome base.');
    if (dest && !urlValida(dest)) return (erro.textContent = 'Link inválido.');
    criar.disabled = true; const feitos = [];
    try {
      for (let k = 0; k < n; k++) {
        const num = String(i0 + k).padStart(3, '0');
        for (let t = 0; t < 5; t++) {
          try { feitos.push(await D.salvar({ codigo: novoCodigo(), nome: `${nome.value.trim()} ${num}`, cliente: '', telefone: '', observacao: '', destino: dest || null, validade: validade.value || null, ativo: true, destino_vencido: null })); break; }
          catch (e) { if (!/já existe/.test(e.message) || t === 4) throw e; }
        }
        criar.textContent = `Criando… ${k + 1}/${n}`;
      }
      await recarregar();
      rep(corpoJ, h('div', { class: 'caixa-info', text: `${feitos.length} QR Codes criados (${feitos[0].nome} … ${feitos.at(-1).nome}).${dest ? '' : ' Estão sem destino: na venda, abra o QR da placa e coloque o link do cliente.'}` }),
        h('div', { class: 'rapidos' },
          h('button', { class: 'btn primario', text: 'Baixar os QRs (.zip)', onclick: () => zipQRs(feitos) }),
          h('button', { class: 'btn', text: 'Fechar', onclick: () => veu.remove() })));
    } catch (e) { erro.textContent = e.message + (feitos.length ? ` (${feitos.length} criados antes do erro)` : ''); await recarregar(); }
    finally { criar.disabled = false; criar.textContent = 'Criar QRs'; }
  } });
  const corpoJ = h('div', {},
    h('p', { class: 'sub', text: 'Cria vários QRs de uma vez, numerados (ex.: Placa Google 001, 002…). Ótimo pra imprimir as placas antes e só ativar o link na hora da venda.' }),
    campo('Nome base', nome), h('div', { class: 'duas' }, campo('Quantidade', qtd), campo('Começar no número', ini)),
    campo('Link de destino', destino), campo('Válido até (opcional)', validade), erro,
    h('div', { class: 'rapidos' }, criar, h('button', { class: 'btn', text: 'Cancelar', onclick: () => veu.remove() })));
  veu.append(h('div', { class: 'janela' }, h('div', { class: 'lat-topo', style: 'padding:0 0 12px' }, h('h2', { text: 'Criar em lote' }), h('button', { class: 'fechar', text: '×', onclick: () => veu.remove() })), corpoJ));
  document.body.append(veu); nome.focus();
}
function proximoNumero(base) {
  const b = base.trim().toLowerCase(); let mx = 0;
  for (const l of LINKS) { const m = l.nome.toLowerCase().startsWith(b + ' ') && l.nome.slice(b.length).trim().match(/^(\d+)$/); if (m) mx = Math.max(mx, +m[1]); }
  return mx + 1;
}
async function zipQRs(lista) {
  if (!window.JSZip) return aviso('Não carregou o JSZip (sem internet?).', true);
  const z = new JSZip(), linhas = [['nome', 'codigo', 'link_curto', 'destino', 'validade']];
  for (const l of lista) {
    z.file(`${nomeArquivo(l.nome)}-${l.codigo}.png`, await pngQR(linkCurto(l), { tam: 1024 }));
    z.file(`svg/${nomeArquivo(l.nome)}-${l.codigo}.svg`, svgQR(linkCurto(l)));
    linhas.push([l.nome, l.codigo, linkCurto(l), l.destino || '', l.validade ? dataBR(l.validade) : '']);
  }
  z.file('lista.csv', '﻿' + csv(linhas));
  baixar(await z.generateAsync({ type: 'blob' }), `QRs-${nomeArquivo(lista[0].nome)}.zip`);
}

// ---------------- CSV ----------------
const csv = linhas => linhas.map(l => l.map(v => { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(';')).join('\r\n');
function exportarCSV() {
  const l = filtrados();
  const linhas = [['nome', 'cliente', 'telefone', 'link_curto', 'destino', 'validade', 'situacao', 'cliques', 'ultimo_clique', 'criado_em', 'observacao'],
    ...l.map(x => [x.nome, x.cliente, x.telefone, linkCurto(x), x.destino, x.validade ? dataBR(x.validade) : '', ROTULO[status(x)], x.cliques, x.ultimo_clique ? dataHora(x.ultimo_clique) : '', dataHora(x.criado_em), x.observacao])];
  baixar(new Blob(['﻿' + csv(linhas)], { type: 'text/csv' }), `qr-dinamico-${hoje()}.csv`);
}

iniciar();
})();
