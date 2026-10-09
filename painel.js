// QR Dinâmico — painel (sem build: HTML + JS puro).
// Dados no Supabase (ou no navegador, em modo demonstração).
(() => {
'use strict';
const CFG = window.QR_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
const ADMIN = window.QR_MODO === 'admin';                     // admin.html = admin | index.html = cliente
const WPP = String(CFG.WHATSAPP ?? '5561920069782').replace(/\D/g, '');
const linkWpp = msg => `https://wa.me/${WPP}?text=${encodeURIComponent(msg)}`;
const ICONE_WPP = '<svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9 3 3.28 8.7 3.28 15.73c0 2.25.6 4.45 1.72 6.38L3 29l7.08-1.86a12.7 12.7 0 0 0 5.96 1.5h.01c7.03 0 12.76-5.7 12.76-12.73S23.08 3 16.04 3zm0 23.3h-.01c-1.9 0-3.77-.51-5.4-1.48l-.39-.23-4.2 1.1 1.12-4.09-.25-.42a10.5 10.5 0 0 1-1.62-5.45c0-5.84 4.77-10.6 10.65-10.6 2.84 0 5.51 1.1 7.52 3.11a10.5 10.5 0 0 1 3.12 7.5c0 5.85-4.78 10.6-10.54 10.6zm5.84-7.94c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.51-.16-.72.16-.21.32-.83 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.44 5.47 4.83.76.33 1.36.53 1.83.67.77.24 1.46.21 2.02.13.62-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37z"/></svg>';
function botaoWpp(texto, msg, cls = '') { const a = h('a', { class: 'btn wpp ' + cls, href: linkWpp(msg), target: '_blank', rel: 'noopener' }); a.innerHTML = ICONE_WPP; a.append(h('span', { text: texto })); return a; }
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
let CLIENTES = [], EU = null;                              // admin: lista de clientes | cliente: o próprio cadastro
const donoDe = l => (l.dono ? (ADMIN ? CLIENTES.find(c => c.id === l.dono) : EU) : null);
// validade que vale de verdade: a do link ou a do plano do cliente, o que vencer primeiro
function validadeEf(l) { const c = donoDe(l); const v = [l.validade, c && c.validade].filter(Boolean).sort(); return v[0] || null; }
function status(l) {
  const c = donoDe(l), v = validadeEf(l);
  if (!l.ativo || (c && c.ativo === false)) return 'inativo';
  if (v && v < hoje()) return 'vencido';
  if (!l.destino) return 'sem_destino';
  if (v && diasAte(v) <= 7) return 'avencer';
  return 'ok';
}
const ROTULO = { ok: 'Ativo', avencer: 'Vence logo', vencido: 'Vencido', inativo: 'Desativado', sem_destino: 'Sem destino' };
function selo(l) {
  const s = status(l);
  let t = ROTULO[s];
  if (s === 'avencer') { const d = diasAte(validadeEf(l)); t = d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d > 1 ? 's' : ''}`; }
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
// Mesma interface nos dois modos. Cliente: só os próprios links (as regras de verdade ficam no banco).
function dadosDemo() {
  const K = 'qr-dinamico-demo';
  const ler = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch { return null; } };
  const gravar = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  let db = ler();
  if (!db || !db.clientes) {
    const agora = Date.now(), dia = 864e5, h0 = hoje();
    const clientes = [
      { id: 'cli-pizza', user_id: 'demo', nome: 'Pizzaria Bella', email: 'pizzaria@exemplo.com', telefone: '(61) 99999-0000', limite: 5, validade: somaMeses(h0, 6), ativo: true, observacao: '', criado_em: new Date(agora - 50 * dia).toISOString() },
      { id: 'cli-cafe', user_id: null, nome: 'Café Central', email: 'cafe@exemplo.com', telefone: '', limite: 3, validade: null, ativo: true, observacao: '', criado_em: new Date(agora - 10 * dia).toISOString() },
    ];
    const ex = (codigo, nome, cliente, destino, validade, dono = null) => ({ id: uuid(), codigo, nome, cliente, telefone: '', observacao: '', destino, validade, ativo: true, destino_vencido: null, dono, cliques: 0, ultimo_clique: null, criado_em: new Date(agora - 40 * dia).toISOString(), atualizado_em: new Date(agora - 40 * dia).toISOString() });
    const links = [
      ex('rb7k2m', 'Placa Google – Barbearia RB', 'Barbearia RB', 'https://g.page/r/exemplo-rb/review', somaMeses(h0, 11)),
      ex('pz4h8q', 'Placa Instagram – balcão', 'Pizzaria Bella', 'https://instagram.com/pizzariabella', null, 'cli-pizza'),
      ex('pz7c3d', 'Cardápio da mesa', 'Pizzaria Bella', 'https://pizzariabella.com.br/cardapio', null, 'cli-pizza'),
      ex('ct9w3x', 'Cardápio – Café Central', 'Café Central', 'https://cafecentral.com.br/cardapio', somaDias(h0, -3), 'cli-cafe'),
      ex('es2n6v', 'Placa Google 004 (estoque)', '', '', null),
    ];
    const cliques = [];
    const disp = ['celular', 'celular', 'celular', 'tablet', 'computador'], sis = ['Android', 'Android', 'iPhone/iPad', 'iPhone/iPad', 'Windows'], cid = ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Guará'];
    links.slice(0, 4).forEach((l, k) => {
      const n = [140, 60, 45, 35][k];
      for (let i = 0; i < n; i++) {
        const em = new Date(agora - Math.random() * 38 * dia), ok = !(k === 3 && em > new Date(agora - 3 * dia));
        cliques.push({ id: cliques.length + 1, link_id: l.id, em: em.toISOString(), resultado: ok ? 'ok' : 'vencido', dispositivo: disp[i % 5], sistema: sis[(i * 7) % 5], navegador: i % 3 ? 'Chrome' : 'Safari', pais: 'BR', regiao: 'DF', cidade: cid[(i * 3) % 5], origem: null });
        if (ok) { l.cliques++; if (!l.ultimo_clique || em.toISOString() > l.ultimo_clique) l.ultimo_clique = em.toISOString(); }
      }
    });
    db = { links, cliques, clientes }; gravar(db);
  }
  const eu = () => db.clientes.find(c => c.id === 'cli-pizza');        // no modo demo, a página do cliente é a Pizzaria Bella
  const meus = () => (ADMIN ? db.links : db.links.filter(l => l.dono === 'cli-pizza'));
  const planoOk = () => { const c = eu(); if (!c.ativo) throw new Error('Sua conta está bloqueada. Fale com a gente.'); if (c.validade && c.validade < hoje()) throw new Error(`Seu plano venceu em ${dataBR(c.validade)}. Fale com a gente pra renovar.`); };
  return {
    async sessao() { return ADMIN ? { email: 'demonstração', admin: true } : { email: eu().email, cliente: { status: 'ok', ...eu(), usados: meus().length } }; },
    async listar() { return structuredClone(meus()); },
    async salvar(l) {
      if (!/^[a-z0-9_-]{3,32}$/.test(l.codigo)) throw new Error('Código inválido.');
      if (db.links.some(x => x.codigo === l.codigo && x.id !== l.id)) throw new Error('Esse código já existe.');
      const agora = new Date().toISOString();
      if (!ADMIN) {
        planoOk();
        if (l.id) { const x = db.links.find(y => y.id === l.id && y.dono === 'cli-pizza'); Object.assign(x, { nome: l.nome, destino: l.destino || null, observacao: l.observacao, atualizado_em: agora }); gravar(db); return structuredClone(x); }
        if (meus().length >= eu().limite) throw new Error(`Limite de ${eu().limite} QR Codes atingido. Fale com a gente pra aumentar.`);
        const n = { id: uuid(), codigo: l.codigo, nome: l.nome, destino: l.destino || null, observacao: l.observacao || '', dono: 'cli-pizza', cliente: eu().nome, telefone: eu().telefone, ativo: true, validade: null, destino_vencido: null, cliques: 0, ultimo_clique: null, criado_em: agora, atualizado_em: agora };
        db.links.push(n); gravar(db); return structuredClone(n);
      }
      if (l.id) { const i = db.links.findIndex(x => x.id === l.id); db.links[i] = { ...db.links[i], ...l, atualizado_em: agora }; gravar(db); return structuredClone(db.links[i]); }
      const n = { cliques: 0, ultimo_clique: null, dono: null, ...l, id: uuid(), criado_em: agora, atualizado_em: agora }; db.links.push(n); gravar(db); return structuredClone(n);
    },
    async apagar(id) { db.links = db.links.filter(x => x.id !== id); db.cliques = db.cliques.filter(c => c.link_id !== id); gravar(db); },
    async zerar(id) { db.cliques = db.cliques.filter(c => c.link_id !== id); const l = db.links.find(x => x.id === id); l.cliques = 0; l.ultimo_clique = null; gravar(db); },
    async cliques(id, dias) { const d = Date.now() - dias * 864e5, ids = new Set(meus().map(l => l.id)); return db.cliques.filter(c => ids.has(c.link_id) && (!id || c.link_id === id) && new Date(c.em) >= d).sort((a, b) => b.em.localeCompare(a.em)); },
    async simular(l) {                     // simula a leitura do QR (só no modo demonstração)
      const st = status(l) === 'avencer' ? 'ok' : status(l);
      db.cliques.push({ id: db.cliques.length + 1, link_id: l.id, em: new Date().toISOString(), resultado: st, dispositivo: 'celular', sistema: 'Android', navegador: 'Chrome', pais: 'BR', regiao: 'DF', cidade: 'Brasília', origem: null });
      const x = db.links.find(y => y.id === l.id); if (st === 'ok') { x.cliques++; x.ultimo_clique = new Date().toISOString(); }
      gravar(db); return st;
    },
    async clientes() { return structuredClone(db.clientes); },
    async salvarCliente(c) {
      if (db.clientes.some(x => x.email === c.email && x.id !== c.id)) throw new Error('Já existe um cliente com esse e-mail.');
      if (c.id) { const i = db.clientes.findIndex(x => x.id === c.id); db.clientes[i] = { ...db.clientes[i], ...c }; gravar(db); return structuredClone(db.clientes[i]); }
      const n = { user_id: null, ...c, id: uuid(), criado_em: new Date().toISOString() }; db.clientes.push(n); gravar(db); return structuredClone(n);
    },
    async apagarCliente(id) { db.clientes = db.clientes.filter(c => c.id !== id); db.links.forEach(l => { if (l.dono === id) l.dono = null; }); gravar(db); },
    async config() { return { cadastro_aberto: true, limite_padrao: 5, dias_validade: null, ...(db.config || {}) }; },
    async salvarConfig(c) { db.config = { ...c }; gravar(db); },
    async sair() { },
  };
}

function dadosSupabase() {
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(traduzErro(error)); return data; };
  const traduzErro = e => {
    const m = e.message || String(e);
    if (/qr_clientes_email_key/i.test(m)) return 'Já existe um cliente com esse e-mail.';
    if (/duplicate key|qr_links_codigo_key/i.test(m)) return 'Esse código já existe. Escolha outro.';
    if (/row-level security|permission denied|Sem permissão/i.test(m)) return ADMIN ? 'Sem permissão: seu usuário não está liberado como admin (veja o LEIA-ME).' : 'Sem permissão. Fale com a gente pelo WhatsApp.';
    if (/check constraint/i.test(m)) return 'Algum campo está num formato inválido.';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail primeiro: clique no link que enviamos (veja também o spam).';
    if (/User already registered/i.test(m)) return 'Esse e-mail já tem cadastro. Use "Entrar" ou "Esqueci a senha".';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Login com Google ainda não foi ativado no Supabase (veja o LEIA-ME).';
    if (/Password should be|weak password/i.test(m)) return 'Senha fraca: use pelo menos 8 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
    if (/load failed|failed to fetch|networkerror/i.test(m)) return 'Sem conexão com o servidor. Confira a internet.';
    return m;
  };
  const CAMPOS = ADMIN ? ['codigo', 'nome', 'cliente', 'telefone', 'observacao', 'destino', 'validade', 'ativo', 'destino_vencido', 'dono'] : ['nome', 'destino', 'observacao'];
  const volta = location.origin + location.pathname;
  return {
    sb,
    async sessao() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      if (ADMIN) {
        const adm = await sb.from('qr_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
        return { email: data.session.user.email, admin: !!adm.data };
      }
      return { email: data.session.user.email, cliente: ok(await sb.rpc('qr_vincular')) };
    },
    async entrar(email, senha) { ok(await sb.auth.signInWithPassword({ email, password: senha })); },
    async cadastrar(email, senha, nome) { const d = ok(await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: volta, data: { nome } } })); return !!d.session; },
    async entrarGoogle() { ok(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } })); },
    async config() { return ok(await sb.from('qr_config').select('*').eq('id', 1).maybeSingle()) || { cadastro_aberto: true, limite_padrao: 5, dias_validade: null }; },
    async salvarConfig(c) { ok(await sb.from('qr_config').upsert({ id: 1, cadastro_aberto: !!c.cadastro_aberto, limite_padrao: c.limite_padrao, dias_validade: c.dias_validade || null })); },
    async esqueci(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: volta })); },
    async novaSenha(senha) { ok(await sb.auth.updateUser({ password: senha })); },
    aoRecuperar(f) { sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') f(); }); },
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
      dados.nome = l.nome; if (ADMIN) dados.ativo = !!l.ativo;
      if (l.id) return ok(await sb.from('qr_links').update(dados).eq('id', l.id).select().single());
      if (!ADMIN) dados.codigo = l.codigo;
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
    async clientes() { return ok(await sb.from('qr_clientes').select('*').order('nome')); },
    async salvarCliente(c) {
      const d = { nome: c.nome, email: c.email, telefone: c.telefone || null, limite: c.limite, validade: c.validade || null, ativo: !!c.ativo, observacao: c.observacao || null };
      if (c.id) return ok(await sb.from('qr_clientes').update(d).eq('id', c.id).select().single());
      return ok(await sb.from('qr_clientes').insert(d).select().single());
    },
    async apagarCliente(id) { ok(await sb.from('qr_clientes').delete().eq('id', id)); },
  };
}

const D = DEMO ? dadosDemo() : dadosSupabase();
let LINKS = [], filtro = { busca: '', tipo: 'todos', ordem: 'recentes', dono: '' }, CLIQUES30 = [];

// ---------------- telas ----------------
async function iniciar() {
  if (DEMO) { const s = await D.sessao(); if (!ADMIN) EU = s.cliente; return montarPainel(s); }
  let s;
  try { s = await D.sessao(); } catch (e) { return telaLogin(e.message); }
  if (!s) return telaLogin();
  if (ADMIN) {
    if (!s.admin) return telaLogin('Este usuário entrou, mas não está liberado como admin. Rode o comando do LEIA-ME (qr_admins) com o seu e-mail.');
    return montarPainel(s);
  }
  const c = s.cliente || {};
  if (c.status === 'sem_confirmar') return telaAviso('Confirme seu e-mail', `Enviamos um link de confirmação pra ${s.email}. Clique nele (veja também o spam) e entre de novo.`);
  if (c.status === 'sem_cadastro') return telaAviso('Cadastros fechados no momento', `Não conseguimos criar sua conta (${s.email}) agora. Fale com a gente pelo WhatsApp que liberamos rapidinho.`);
  if (c.status === 'bloqueado') return telaAviso('Conta bloqueada', 'Seu acesso está pausado no momento. Fale com a gente pelo WhatsApp.');
  EU = c;
  montarPainel(s);
}

function logoQR() { const d = h('div', { class: 'logo-qr' }); d.innerHTML = '<svg viewBox="0 0 32 32" width="22" height="22"><path fill="#fff" d="M5 5h9v9H5zm2 2v5h5V7zm11-2h9v9h-9zm2 2v5h5V7zM5 18h9v9H5zm2 2v5h5v-5zm11-2h3v3h-3zm5 0h4v4h-4zm-5 5h4v4h-4zm6 2h3v2h-3z"/></svg>'; return d; }

function telaAviso(titulo, texto) {
  rep(app, h('div', { class: 'tela-login' }, h('div', { class: 'caixa-login' },
    h('h1', { text: titulo }), h('p', { text: texto }),
    botaoWpp('Falar no WhatsApp', `Olá! Preciso de ajuda com o acesso ao painel de QR Codes (${MARCA}).`),
    h('button', { class: 'btn', text: 'Sair', onclick: async () => { await D.sair(); telaLogin(); } }))));
}

function telaLogin(msg = '', modo = 'entrar') {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', autocomplete: modo === 'criar' ? 'new-password' : 'current-password', minlength: 8 });
  const senha2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8 });
  const nomeC = h('input', { autocomplete: 'organization', placeholder: 'Nome da empresa ou seu nome', maxlength: 120 });
  const lNome = campo('Nome / empresa', nomeC);
  const google = ADMIN ? null : h('button', { class: 'btn btn-google', type: 'button', onclick: async () => { erro.textContent = ''; try { await D.entrarGoogle(); } catch (x) { erro.textContent = x.message; } } });
  if (google) { google.innerHTML = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>'; google.append(h('span', { text: 'Continuar com o Google' })); }
  const ou = ADMIN ? null : h('div', { class: 'ou' }, h('span', { text: 'ou com e-mail' }));
  const erro = h('p', { class: 'erro-msg', text: msg });
  const btn = h('button', { class: 'btn primario', type: 'submit' });
  const titulo = h('h2');
  const lEmail = campo('E-mail', email), lSenha = campo('Senha', senha), lSenha2 = campo('Repita a senha', senha2);
  const abas = h('div', { class: 'abas-login' });
  const esqueci = h('button', { class: 'link-login', type: 'button' });
  const mudar = m => {
    modo = m; erro.textContent = ''; erro.className = 'erro-msg';
    abas.hidden = ADMIN || m === 'esqueci' || m === 'nova';
    abas.querySelectorAll('button').forEach(b => b.classList.toggle('ativa', b.dataset.m === m));
    titulo.textContent = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha', nova: 'Criar nova senha' }[m];
    btn.textContent = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link por e-mail', nova: 'Salvar nova senha' }[m];
    lEmail.hidden = m === 'nova'; lSenha.hidden = m === 'esqueci'; lSenha2.hidden = !(m === 'criar' || m === 'nova'); lNome.hidden = m !== 'criar';
    if (google) google.hidden = ou.hidden = m === 'esqueci' || m === 'nova';
    esqueci.hidden = ADMIN && m !== 'entrar' ? true : m === 'nova';
    esqueci.textContent = m === 'esqueci' ? '← Voltar' : 'Esqueci a senha';
    senha.autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
  };
  for (const [m, t] of [['entrar', 'Entrar'], ['criar', 'Criar conta']]) abas.append(h('button', { type: 'button', 'data-m': m, text: t, onclick: () => mudar(m) }));
  esqueci.onclick = () => mudar(modo === 'esqueci' ? 'entrar' : 'esqueci');
  const okMsg = t => { erro.className = 'erro-msg ok'; erro.textContent = t; };
  const f = h('form', { class: 'caixa-login', novalidate: true, onsubmit: async e => {
    e.preventDefault(); erro.textContent = ''; erro.className = 'erro-msg';
    const em = email.value.trim().toLowerCase();
    if (modo !== 'nova' && !/^\S+@\S+\.\S+$/.test(em)) return (erro.textContent = 'Digite um e-mail válido.');
    if ((modo === 'criar' || modo === 'nova') && senha.value.length < 8) return (erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.');
    if ((modo === 'criar' || modo === 'nova') && senha.value !== senha2.value) return (erro.textContent = 'As senhas não são iguais.');
    btn.disabled = true;
    try {
      if (modo === 'entrar') { await D.entrar(em, senha.value); await iniciar(); }
      else if (modo === 'criar') {
        if (!nomeC.value.trim()) { erro.textContent = 'Digite o nome da empresa ou o seu nome.'; return; }
        const logado = await D.cadastrar(em, senha.value, nomeC.value.trim());
        if (logado) await iniciar(); else okMsg('Pronto! Enviamos um e-mail de confirmação. Clique no link do e-mail (veja também o spam) e depois entre aqui.');
      }
      else if (modo === 'esqueci') { await D.esqueci(em); okMsg('Se esse e-mail tiver cadastro, enviamos um link pra criar uma senha nova.'); }
      else { await D.novaSenha(senha.value); history.replaceState(null, '', location.pathname); aviso('Senha alterada!'); await iniciar(); }
    } catch (x) { erro.textContent = x.message; }
    finally { btn.disabled = false; }
  } },
  h('div', { class: 'marca-login' }, logoQR(), h('div', {}, ADMIN ? 'QR Dinâmico · Admin' : 'Meus QR Codes', h('small', { text: MARCA }))),
  abas, titulo, google, ou, lNome, lEmail, lSenha, lSenha2, erro, btn, esqueci,
  ADMIN ? null : h('p', { class: 'nota-login', text: 'Ao criar a conta você já entra e pode gerar seus QR Codes.' }));
  const lado = ADMIN ? null : h('section', { class: 'apresenta' },
    h('h1', { text: 'QR Code dinâmico pra sua empresa' }),
    h('p', { text: 'Placas e adesivos com QR Code que você mesmo atualiza: troque o link quando quiser, sem reimprimir, e acompanhe quantas pessoas escanearam.' }),
    h('ul', {}, h('li', { text: 'Avaliações no Google, Instagram, cardápio, Wi-Fi, WhatsApp…' }), h('li', { text: 'Troque o destino a qualquer momento' }), h('li', { text: 'Veja as leituras por dia, aparelho e cidade' })),
    botaoWpp('Quero saber mais / Falar no WhatsApp', `Olá! Vim pela página de QR Codes da ${MARCA} e queria saber mais.`, 'grande'));
  rep(app, h('div', { class: 'tela-login' + (ADMIN ? '' : ' com-lado') }, lado, f));
  mudar(modo);
  if (modo !== 'nova') email.focus(); else senha.focus();
}

function montarPainel(sessao) {
  app.innerHTML = '';
  const acoes = ADMIN ? [
    h('button', { class: 'btn primario', text: '+ Novo QR', onclick: () => abrirLink(null) }),
    h('button', { class: 'btn', text: 'Clientes', onclick: abrirClientes }),
    h('button', { class: 'btn', text: 'Criar em lote', onclick: abrirLote }),
    h('button', { class: 'btn', text: 'Exportar CSV', onclick: exportarCSV }),
  ] : [
    h('button', { class: 'btn primario', id: 'btnNovo', text: '+ Novo QR', onclick: () => novoDoCliente() }),
    botaoWpp('WhatsApp', `Olá! Sou cliente (${EU?.nome || ''}) e preciso de ajuda com meus QR Codes.`),
  ];
  acoes.push(DEMO ? h('button', { class: 'btn', text: 'Zerar demonstração', onclick: () => { if (confirm('Apagar os dados da demonstração e recomeçar?')) { localStorage.removeItem('qr-dinamico-demo'); location.reload(); } } })
    : h('button', { class: 'btn', text: 'Sair', title: sessao.email, onclick: async () => { await D.sair(); telaLogin(); } }));
  add(app,
    h('header', { class: 'topo' },
      h('div', { class: 'marca' }, logoQR(), h('div', {}, ADMIN ? 'QR Dinâmico' : 'Meus QR Codes', h('small', { text: ADMIN ? MARCA : (EU?.nome || MARCA) }))),
      h('div', { class: 'acoes' }, acoes)),
    DEMO ? h('div', { class: 'demo', text: ADMIN ? 'Modo demonstração (admin): os dados ficam só neste navegador e o link curto não redireciona de verdade (use "Simular leitura"). Preencha o config.js com o Supabase pra usar pra valer.'
      : 'Modo demonstração (página do cliente "Pizzaria Bella"): os dados ficam só neste navegador. Preencha o config.js com o Supabase pra usar pra valer.' }) : null,
    h('main', {}, ADMIN ? null : h('div', { id: 'plano' }), h('section', { class: 'cards' + (ADMIN ? '' : ' tres'), id: 'cards' }), barraBusca(), h('section', { class: 'lista', id: 'lista' })),
  );
  recarregar();
}

function barraBusca() {
  const busca = h('input', { type: 'search', placeholder: ADMIN ? 'Procurar por nome, cliente, código ou link…' : 'Procurar por nome ou link…', value: filtro.busca, oninput: e => { filtro.busca = e.target.value; desenharLista(); } });
  const tipo = h('select', { onchange: e => { filtro.tipo = e.target.value; desenharLista(); } },
    ...[['todos', 'Todos'], ['ativos', 'Ativos'], ['avencer', 'Vencem em 30 dias'], ['vencidos', 'Vencidos'], ['sem_destino', 'Sem destino' + (ADMIN ? ' (estoque)' : '')], ['inativos', 'Desativados']].map(([v, t]) => h('option', { value: v, text: t })));
  const ordem = h('select', { onchange: e => { filtro.ordem = e.target.value; desenharLista(); } },
    ...[['recentes', 'Mais recentes'], ['cliques', 'Mais cliques'], ['validade', 'Validade mais próxima'], ['nome', 'Nome (A-Z)']].map(([v, t]) => h('option', { value: v, text: t })));
  tipo.value = filtro.tipo; ordem.value = filtro.ordem;
  const dono = ADMIN ? h('select', { id: 'filtroDono', onchange: e => { filtro.dono = e.target.value; desenharLista(); } }) : null;
  return h('div', { class: 'barra' }, busca, tipo, dono, ordem);
}
function preencherFiltroDono() {
  const s = document.getElementById('filtroDono'); if (!s) return;
  rep(s, h('option', { value: '', text: 'Todos os clientes' }), h('option', { value: '-', text: 'Sem cliente (meus)' }), ...CLIENTES.map(c => h('option', { value: c.id, text: c.nome })));
  s.value = CLIENTES.some(c => c.id === filtro.dono) || filtro.dono === '-' ? filtro.dono : ''; filtro.dono = s.value;
}

async function recarregar() {
  try {
    if (ADMIN) [LINKS, CLIQUES30, CLIENTES] = await Promise.all([D.listar(), D.cliques(null, 30), D.clientes()]);
    else { [LINKS, CLIQUES30] = await Promise.all([D.listar(), D.cliques(null, 30)]); const s = await D.sessao().catch(() => null); if (s?.cliente?.id) EU = s.cliente; }
  } catch (e) { aviso(e.message, true); LINKS = LINKS || []; }
  if (ADMIN) preencherFiltroDono(); else desenharPlano();
  desenharCards(); desenharLista();
}

function desenharPlano() {
  const box = document.getElementById('plano'); if (!box || !EU) return;
  const usados = LINKS.length, lim = EU.limite, cheio = usados >= lim, venc = EU.validade && EU.validade < hoje();
  const btn = document.getElementById('btnNovo'); if (btn) { btn.disabled = cheio || venc; btn.title = venc ? 'Plano vencido' : cheio ? 'Limite atingido' : ''; }
  const partes = [`Você está usando ${usados} de ${lim} QR Code${lim === 1 ? '' : 's'}.`];
  if (EU.validade) partes.push(venc ? `Seu plano venceu em ${dataBR(EU.validade)}: seus QR Codes estão parados.` : `Plano válido até ${dataBR(EU.validade)}${diasAte(EU.validade) <= 15 ? ` (faltam ${diasAte(EU.validade)} dias)` : ''}.`);
  const alerta = venc || cheio || (EU.validade && diasAte(EU.validade) <= 15);
  rep(box, h('div', { class: 'plano ' + (venc ? 'erro' : alerta ? 'alerta' : '') },
    h('div', {}, h('div', { class: 'barra-uso' }, h('i', { style: `width:${Math.min(100, 100 * usados / Math.max(1, lim))}%` })), h('span', { text: partes.join(' ') })),
    alerta ? botaoWpp(venc ? 'Renovar pelo WhatsApp' : cheio ? 'Pedir mais QR Codes' : 'Renovar', venc ? `Olá! Sou ${EU.nome} e quero renovar meu plano de QR Codes.` : `Olá! Sou ${EU.nome} e quero ${cheio ? 'aumentar meu limite de QR Codes' : 'renovar meu plano de QR Codes'}.`) : null));
}

function desenharCards() {
  const c = document.getElementById('cards'); if (!c) return;
  const st = LINKS.map(status);
  const ativos = st.filter(s => s === 'ok' || s === 'avencer').length;
  const venc = st.filter(s => s === 'vencido').length;
  const av = LINKS.filter(l => { const v = validadeEf(l); return l.ativo && v && v >= hoje() && diasAte(v) <= 30; }).length;
  const cl = CLIQUES30.filter(x => x.resultado === 'ok').length;
  const card = (n, r, tipo, cls = '') => h('div', { class: 'card ' + cls, onclick: () => { if (tipo) { filtro.tipo = tipo; document.querySelector('.barra select').value = tipo; desenharLista(); } } }, h('div', { class: 'n', text: n }), h('div', { class: 'r', text: r }));
  if (!ADMIN) return rep(c, card(EU ? `${LINKS.length}/${EU.limite}` : LINKS.length, 'QR Codes', 'todos'), card(ativos, 'Funcionando', 'ativos'), card(cl, 'Leituras nos últimos 30 dias', null));
  rep(c, card(LINKS.length, 'QR Codes', 'todos'), card(ativos, 'Ativos', 'ativos'), card(av, 'Vencem em 30 dias', 'avencer', av ? 'alerta' : ''),
    card(venc, 'Vencidos', 'vencidos', venc ? 'erro' : ''), card(cl, 'Leituras nos últimos 30 dias', null));
}

function filtrados() {
  const b = filtro.busca.trim().toLowerCase();
  let l = LINKS.filter(x => !b || [x.nome, x.cliente, x.codigo, x.destino, x.telefone, x.observacao, donoDe(x)?.nome].some(v => (v || '').toLowerCase().includes(b)));
  if (ADMIN && filtro.dono) l = l.filter(x => (filtro.dono === '-' ? !x.dono : x.dono === filtro.dono));
  const t = filtro.tipo;
  l = l.filter(x => {
    const s = status(x), v = validadeEf(x);
    if (t === 'ativos') return s === 'ok' || s === 'avencer';
    if (t === 'vencidos') return s === 'vencido';
    if (t === 'inativos') return s === 'inativo';
    if (t === 'sem_destino') return s === 'sem_destino';
    if (t === 'avencer') return x.ativo && v && v >= hoje() && diasAte(v) <= 30;
    return true;
  });
  const o = filtro.ordem;
  l.sort((a, b2) => o === 'cliques' ? b2.cliques - a.cliques
    : o === 'validade' ? (validadeEf(a) || '9999').localeCompare(validadeEf(b2) || '9999')
    : o === 'nome' ? a.nome.localeCompare(b2.nome, 'pt-BR')
    : b2.criado_em.localeCompare(a.criado_em));
  return l;
}

function desenharLista() {
  const box = document.getElementById('lista'); if (!box) return;
  const l = filtrados();
  const cab = h('div', { class: 'linha cab' }, h('div', { text: ADMIN ? 'Nome / cliente' : 'Nome' }), h('div', { text: 'Link curto' }), h('div', { text: 'Destino' }), h('div', { text: 'Validade' }), h('div', { class: 'num', text: 'Cliques' }), h('div', { text: 'Situação' }));
  if (!l.length) {
    rep(box, cab, h('div', { class: 'vazio', text: LINKS.length ? 'Nada encontrado com esse filtro.' : ADMIN ? 'Nenhum QR ainda. Clique em "+ Novo QR" ou "Criar em lote".' : 'Você ainda não tem QR Codes. Clique em "+ Novo QR" pra criar o primeiro.' }));
    return;
  }
  rep(box, cab, ...l.map(x => {
    const dono = donoDe(x), v = validadeEf(x);
    return h('div', { class: 'linha', onclick: () => abrirLink(x) },
      h('div', {}, h('div', { class: 'nome', text: x.nome }),
        ADMIN ? h('div', { class: 'sub' }, dono ? h('span', { class: 'tag-dono', text: '👤 ' + dono.nome }) : (x.cliente || '—')) : (x.observacao ? h('div', { class: 'sub', text: x.observacao }) : null)),
      h('div', { class: 'cod' }, h('span', { text: '/' + x.codigo }), h('button', { class: 'btn mini', text: 'Copiar', title: linkCurto(x), onclick: e => { e.stopPropagation(); copiar(linkCurto(x)); } })),
      h('div', { class: 'dest', text: x.destino || 'sem destino', title: x.destino || '' }),
      h('div', { class: 'sub', text: v ? dataBR(v) : 'Sem validade' }),
      h('div', { class: 'num', text: x.cliques }),
      h('div', {}, selo(x)));
  }));
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
    ({ dados: ADMIN ? abaDados : abaDadosCliente, qr: abaQR, cliques: abaCliques })[qual](l, corpo, rodape, { novo, fechar, titulo, mostrar });
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
  const dono = h('select', {}, h('option', { value: '', text: '— nenhum (QR só meu) —' }), ...CLIENTES.map(c => h('option', { value: c.id, text: `${c.nome} (${LINKS.filter(x => x.dono === c.id).length}/${c.limite})` })));
  dono.value = l.dono || '';
  dono.addEventListener('change', () => { const c = CLIENTES.find(x => x.id === dono.value); if (c && !cliente.value.trim()) cliente.value = c.nome; });
  const ajudaW = ajudanteWpp(destino);
  const rapVal = h('div', { class: 'rapidos' },
    ...[['+30 dias', () => somaDias(base(), 30)], ['+6 meses', () => somaMeses(base(), 6)], ['+1 ano', () => somaMeses(base(), 12)], ['Sem validade', () => '']]
      .map(([t, f]) => h('button', { class: 'btn mini', type: 'button', text: t, onclick: () => { validade.value = f(); } })));
  const base = () => (validade.value && validade.value > hoje() ? validade.value : hoje());   // renovar soma a partir da validade atual

  const st = status(l);
  add(corpo, 
    st === 'vencido' ? h('div', { class: 'caixa-info alerta', text: `Este QR venceu em ${dataBR(l.validade)}. Quem escaneia vê a página "QR expirou". Renove a validade abaixo e salve.` }) : null,
    st === 'sem_destino' && !ctx.novo ? h('div', { class: 'caixa-info', text: 'QR sem destino (estoque): quem escanear vê "QR ainda não ativado". Na venda, coloque o link do cliente e salve.' }) : null,
    campo('Nome / identificação *', nome),
    campo('Conta do cliente (dono)', dono, dono.value ? 'O cliente vê este QR na página dele e pode trocar o destino. A validade do plano dele também vale aqui.' : 'Vazio = QR só seu. Escolha um cliente pra ele gerenciar este QR na página dele.'),
    h('div', { class: 'duas' }, campo('Cliente (texto)', cliente), campo('Telefone do cliente', tel)),
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
      destino: normUrl(destino.value), validade: validade.value || null, ativo: ativo.checked, destino_vencido: normUrl(destVenc.value), codigo: codigo.value.trim().toLowerCase(), dono: dono.value || null };
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

function ajudanteWpp(destino) {
  const wNum = h('input', { placeholder: 'DDD + número', inputmode: 'tel' }), wMsg = h('input', { placeholder: 'Mensagem (opcional)' });
  const box = h('div', { class: 'caixa-info', hidden: true },
    h('div', { class: 'duas' }, campo('WhatsApp', wNum), campo('Mensagem', wMsg)),
    h('button', { class: 'btn mini', type: 'button', text: 'Usar como destino', onclick: () => {
      const n = wNum.value.replace(/\D/g, ''); if (n.length < 10) return aviso('Digite DDD + número.', true);
      destino.value = `https://wa.me/${n.length <= 11 ? '55' + n : n}${wMsg.value.trim() ? '?text=' + encodeURIComponent(wMsg.value.trim()) : ''}`; box.hidden = true;
    } }));
  return box;
}
function botoesDestino(destino, ajudaW) {
  return h('div', { class: 'rapidos', style: 'margin:-6px 0 14px' }, h('button', { class: 'btn mini', type: 'button', text: 'Montar link do WhatsApp', onclick: () => { ajudaW.hidden = !ajudaW.hidden; } }),
    h('button', { class: 'btn mini', type: 'button', text: 'Testar destino', onclick: () => { const u = normUrl(destino.value); if (urlValida(u)) window.open(u, '_blank', 'noopener'); else aviso('Link inválido.', true); } }));
}

// cliente: cria QR (código automático) e só troca nome, destino e observação
function novoDoCliente() {
  if (EU && LINKS.length >= EU.limite) return aviso(`Você já usa ${LINKS.length} de ${EU.limite} QR Codes. Fale com a gente pra aumentar.`, true);
  abrirLink(null);
}
function abaDadosCliente(l, corpo, rodape, ctx) {
  const nome = h('input', { value: l.nome || '', placeholder: 'Ex.: Placa do balcão, Cardápio mesa 1…', maxlength: 120 });
  const destino = h('input', { value: l.destino || '', placeholder: 'https://… (pra onde o QR vai levar)', inputmode: 'url' });
  const obs = h('textarea', { placeholder: 'Anotações (onde está a placa, etc.)' }); obs.value = l.observacao || '';
  const erro = h('p', { class: 'erro-msg' });
  const ajudaW = ajudanteWpp(destino), v = validadeEf(l), st = status(l);
  add(corpo,
    st === 'vencido' ? h('div', { class: 'caixa-info alerta' }, `Este QR está parado: venceu em ${dataBR(v)}. `, botaoWpp('Renovar pelo WhatsApp', `Olá! Sou ${EU?.nome || ''} e quero renovar meu QR "${l.nome}".`, 'mini')) : null,
    st === 'inativo' ? h('div', { class: 'caixa-info alerta', text: 'Este QR está pausado. Fale com a gente pelo WhatsApp pra reativar.' }) : null,
    campo('Nome (pra você identificar) *', nome),
    campo('Link de destino', destino, 'Pra onde o QR leva. Pode trocar quando quiser: o QR impresso continua o mesmo.'),
    botoesDestino(destino, ajudaW), ajudaW,
    campo('Observações', obs),
    ctx.novo ? h('div', { class: 'caixa-info', text: `O link curto do QR é gerado automaticamente. Você está usando ${LINKS.length} de ${EU?.limite ?? '?'} QR Codes.` })
      : h('div', { class: 'info-lista' },
        h('div', {}, h('span', { text: 'Link do QR' }), h('b', { text: linkCurto(l) })),
        h('div', {}, h('span', { text: 'Validade' }), h('b', { text: v ? dataBR(v) : 'Sem validade' })),
        h('div', {}, h('span', { text: 'Situação' }), selo(l))),
    erro);
  const salvar = h('button', { class: 'btn primario', text: ctx.novo ? 'Criar QR' : 'Salvar', onclick: async () => {
    erro.textContent = '';
    const d = { ...l, nome: nome.value.trim(), destino: normUrl(destino.value), observacao: obs.value.trim() };
    if (!d.nome) return (erro.textContent = 'Dê um nome pra identificar o QR.');
    if (d.destino && !urlValida(d.destino)) return (erro.textContent = 'O link de destino não parece válido.');
    salvar.disabled = true;
    try {
      let r;
      for (let t = 0; t < 5; t++) {                // código aleatório; tenta outro se já existir
        try { r = await D.salvar(ctx.novo ? { ...d, codigo: novoCodigo() } : d); break; }
        catch (e) { if (!ctx.novo || !/já existe/.test(e.message) || t === 4) throw e; }
      }
      Object.assign(l, r);
      aviso(ctx.novo ? 'QR criado!' : 'Salvo! O QR já leva pro link novo.');
      await recarregar();
      if (ctx.novo) { ctx.fechar(); abrirLink(LINKS.find(x => x.id === r.id) || r); setTimeout(() => document.querySelector('.abas [data-a=qr]')?.click(), 0); }
      else { ctx.titulo.textContent = l.nome; ctx.mostrar('dados'); }
    } catch (e) { erro.textContent = e.message; }
    finally { salvar.disabled = false; }
  } });
  add(rodape, salvar);
  if (DEMO && !ctx.novo) add(rodape, h('button', { class: 'btn', text: 'Simular leitura', onclick: async () => {
    const r = await D.simular(l); await recarregar(); Object.assign(l, LINKS.find(x => x.id === l.id));
    if (r === 'ok') { aviso('Leitura registrada, abrindo o destino…'); window.open(l.destino, '_blank', 'noopener'); } else aviso('Leitura registrada: ' + ROTULO[r], true);
  } }));
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
      ADMIN ? `Esse QR tem ${m.n}×${m.n} quadradinhos. Na placa 3D, cole o link curto acima no campo do link (ex.: Placa Google v2): o QR vai apontar pra cá e você troca o destino quando quiser, sem reimprimir.`
        : 'Baixe e use onde quiser (placa, adesivo, cardápio, cartão). Se trocar o link de destino, este mesmo QR passa a levar pro link novo.'),
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
    depois.length ? h('div', { class: 'caixa-info alerta', text: ADMIN ? `${depois.length} leitura(s) nos últimos 90 dias sem redirecionar (QR vencido, pausado ou sem destino). Pode ser hora de renovar!` : `${depois.length} pessoa(s) escanearam nos últimos 90 dias enquanto o QR estava parado ou sem destino.` }) : null,
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
  } }), ADMIN ? h('span', { class: 'esp' }) : null, !ADMIN ? null : h('button', { class: 'btn perigo', text: 'Zerar contagem', onclick: async () => {
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

// ---------------- clientes (admin) ----------------
function situacaoCliente(c) {
  if (!c.ativo) return ['Bloqueado', 'inativo'];
  if (c.validade && c.validade < hoje()) return ['Plano vencido', 'vencido'];
  if (!c.user_id) return ['Aguardando 1º acesso', 'sem_destino'];
  if (c.validade && diasAte(c.validade) <= 15) return [`Vence em ${diasAte(c.validade)} dias`, 'avencer'];
  return ['Ativo', 'ok'];
}
const URL_CLIENTE = () => (CFG.DOMINIO || location.origin).replace(/\/$/, '') + '/';
function abrirClientes() {
  const veu = h('div', { class: 'veu', onclick: e => { if (e.target === veu) fechar(); } });
  const fechar = () => { veu.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', esc);
  const corpo = h('div', { class: 'lat-corpo' }), rodape = h('div', { class: 'lat-rodape' }), titulo = h('h2', { text: 'Clientes' });
  const lista = () => {
    titulo.textContent = `Clientes (${CLIENTES.length})`;
    rep(rodape, h('button', { class: 'btn primario', text: '+ Novo cliente', onclick: () => form(null) }), h('button', { class: 'btn', text: 'Cadastro pelo site…', onclick: configCadastro }));
    if (!CLIENTES.length) return rep(corpo, h('div', { class: 'vazio', text: 'Nenhum cliente ainda. Eles aparecem aqui quando criam conta na página principal, ou cadastre um aqui.' }));
    rep(corpo, h('div', { class: 'lista-clientes' }, ...CLIENTES.map(c => {
      const [t, cls] = situacaoCliente(c), usados = LINKS.filter(l => l.dono === c.id).length;
      return h('div', { class: 'cli', onclick: () => form(c) },
        h('div', {}, h('div', { class: 'nome', text: c.nome }), h('div', { class: 'sub', text: c.email })),
        h('div', { class: 'uso', text: `${usados}/${c.limite} QRs` }),
        h('div', { class: 'sub', text: c.validade ? 'até ' + dataBR(c.validade) : 'sem validade' }),
        h('span', { class: 'selo ' + cls, text: t }));
    })));
  };
  const form = c => {
    const novo = !c; c = c ? { ...c } : { nome: '', email: '', telefone: '', limite: 5, validade: somaMeses(hoje(), 12), ativo: true, observacao: '' };
    titulo.textContent = novo ? 'Novo cliente' : c.nome;
    const nome = h('input', { value: c.nome, placeholder: 'Nome da empresa / cliente' });
    const email = h('input', { type: 'email', value: c.email, placeholder: 'e-mail que ele vai usar pra entrar', readOnly: !!c.user_id });
    const tel = h('input', { value: c.telefone || '', placeholder: '(61) 9 0000-0000', inputmode: 'tel' });
    const limite = h('input', { type: 'number', min: 0, max: 1000, value: c.limite });
    const validade = h('input', { type: 'date', value: c.validade || '' });
    const ativo = h('input', { type: 'checkbox', checked: !!c.ativo });
    const obs = h('textarea', { placeholder: 'Plano, valor, forma de pagamento…' }); obs.value = c.observacao || '';
    const erro = h('p', { class: 'erro-msg' });
    const base = () => (validade.value && validade.value > hoje() ? validade.value : hoje());
    const usados = novo ? 0 : LINKS.filter(l => l.dono === c.id).length;
    rep(corpo,
      h('button', { class: 'btn mini', text: '← Voltar à lista', onclick: lista, style: 'margin-bottom:14px' }),
      !novo ? h('div', { class: 'caixa-info' }, `Usa ${usados} de ${c.limite} QR Codes. `, c.user_id ? 'Já fez o primeiro acesso.' : 'Ainda não fez o primeiro acesso.') : null,
      campo('Nome *', nome), campo('E-mail de acesso *', email, c.user_id ? 'Já vinculado ao login do cliente (não dá pra trocar aqui).' : 'O cliente entra na página principal com esse e-mail (Google ou "Criar conta") e já cai na conta dele.'),
      h('div', { class: 'duas' }, campo('Telefone / WhatsApp', tel), campo('Limite de QR Codes', limite)),
      campo('Plano válido até', validade, 'Depois dessa data os QRs dele param e ele não consegue editar. Vazio = sem validade.'),
      h('div', { class: 'rapidos', style: 'margin:-6px 0 14px' }, ...[['+1 mês', () => somaMeses(base(), 1)], ['+6 meses', () => somaMeses(base(), 6)], ['+1 ano', () => somaMeses(base(), 12)], ['Sem validade', () => '']]
        .map(([t, f]) => h('button', { class: 'btn mini', type: 'button', text: t, onclick: () => { validade.value = f(); } }))),
      h('label', { class: 'chave' }, ativo, 'Ativo (desmarque pra bloquear o acesso e pausar os QRs dele)'),
      campo('Observações', obs), erro);
    const salvar = h('button', { class: 'btn primario', text: novo ? 'Cadastrar cliente' : 'Salvar', onclick: async () => {
      erro.textContent = '';
      const d = { ...c, nome: nome.value.trim(), email: email.value.trim().toLowerCase(), telefone: tel.value.trim(), limite: Math.max(0, Math.min(1000, +limite.value | 0)), validade: validade.value || null, ativo: ativo.checked, observacao: obs.value.trim() };
      if (!d.nome) return (erro.textContent = 'Digite o nome.');
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return (erro.textContent = 'Digite um e-mail válido.');
      salvar.disabled = true;
      try { const r = await D.salvarCliente(d); aviso(novo ? 'Cliente cadastrado!' : 'Salvo!'); await recarregar(); form(CLIENTES.find(x => x.id === r.id) || r); }
      catch (e) { erro.textContent = e.message; } finally { salvar.disabled = false; }
    } });
    rep(rodape, salvar);
    if (!novo) {
      const convite = `Olá, ${c.nome}! Seu acesso aos QR Codes da ${MARCA} está liberado.\n\n1. Acesse ${URL_CLIENTE()}\n2. Clique em "Continuar com o Google" (se ${c.email} for Gmail) ou em "Criar conta" com o e-mail ${c.email}\n\nPor lá você cria seus QR Codes (até ${c.limite}), troca o link quando quiser e vê quantas pessoas escanearam.`;
      add(rodape,
        h('button', { class: 'btn', text: 'Copiar convite', title: 'Texto pronto pra mandar pro cliente', onclick: () => copiar(convite) }),
        c.telefone ? h('a', { class: 'btn wpp', href: `https://wa.me/${(() => { const n = c.telefone.replace(/\D/g, ''); return n.length <= 11 ? '55' + n : n; })()}?text=${encodeURIComponent(convite)}`, target: '_blank', rel: 'noopener', text: 'Enviar convite' }) : null,
        h('button', { class: 'btn', text: 'Ver QRs dele', onclick: () => { filtro.dono = c.id; preencherFiltroDono(); desenharLista(); fechar(); } }),
        h('span', { class: 'esp' }),
        h('button', { class: 'btn perigo', text: 'Apagar', onclick: async () => {
          if (!confirm(`Apagar o cliente "${c.nome}"?\n\nOs QRs dele continuam existindo e funcionando, mas voltam a ser só seus. Se só quer bloquear, desmarque "Ativo".`)) return;
          try { await D.apagarCliente(c.id); aviso('Cliente apagado.'); await recarregar(); lista(); } catch (e) { aviso(e.message, true); }
        } }));
    }
    nome.focus();
  };
  const configCadastro = async () => {
    titulo.textContent = 'Cadastro pelo site';
    let cfg; try { cfg = await D.config(); } catch (e) { return aviso(e.message, true); }
    const aberto = h('input', { type: 'checkbox', checked: !!cfg.cadastro_aberto });
    const lim = h('input', { type: 'number', min: 0, max: 1000, value: cfg.limite_padrao });
    const dias = h('input', { type: 'number', min: 1, max: 3650, value: cfg.dias_validade || '', placeholder: 'vazio = sem validade' });
    rep(corpo,
      h('button', { class: 'btn mini', text: '← Voltar à lista', onclick: lista, style: 'margin-bottom:14px' }),
      h('div', { class: 'caixa-info', text: 'Quem cria conta na página principal (e-mail ou Google) vira cliente na hora com estas regras. Depois você ajusta cada cliente na lista (limite, validade, bloquear).' }),
      h('label', { class: 'chave' }, aberto, 'Cadastro aberto (desmarque pra ninguém novo conseguir criar conta)'),
      h('div', { class: 'duas' }, campo('Limite de QR Codes pra contas novas', lim), campo('Dias de validade pra contas novas', dias, 'Ex.: 30 = teste de 30 dias. Vazio = sem validade.')));
    rep(rodape, h('button', { class: 'btn primario', text: 'Salvar', onclick: async () => {
      try { await D.salvarConfig({ cadastro_aberto: aberto.checked, limite_padrao: Math.max(0, Math.min(1000, +lim.value | 0)), dias_validade: dias.value ? Math.max(1, Math.min(3650, +dias.value | 0)) : null }); aviso('Salvo!'); lista(); }
      catch (e) { aviso(e.message, true); }
    } }));
  };
  veu.append(h('aside', { class: 'lateral' }, h('div', { class: 'lat-topo', style: 'padding-bottom:14px;border-bottom:1px solid var(--linha)' }, titulo, h('button', { class: 'fechar', text: '×', onclick: fechar })), corpo, rodape));
  document.body.append(veu);
  lista();
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

if (!DEMO && D.aoRecuperar) D.aoRecuperar(() => telaLogin('', 'nova'));
if (/type=recovery/.test(location.hash)) telaLogin('', 'nova'); else iniciar();
})();
