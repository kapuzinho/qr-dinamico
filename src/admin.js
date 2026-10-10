// Painel do administrador: usuários, limite de downloads, sessões e histórico.
import './admin.css';
import { exigirLogin, sb, sair, estado, REMOTO } from './core/acesso.js';

const $ = (sel, r = document) => r.querySelector(sel);
const h = (tag, props = {}, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return e;
};
const dataBR = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const aviso = (txt, tipo = 'ok') => {
  const a = $('#aviso'); a.textContent = txt; a.className = `aviso ${tipo}`; a.hidden = false;
  clearTimeout(a._t); a._t = setTimeout(() => { a.hidden = true; }, tipo === 'erro' ? 8000 : 3500);
};
const rpc = async (nome, args = {}) => {
  const { data, error } = await sb.rpc(nome, args);
  if (error) throw new Error(error.hint || error.message);
  return data;
};
async function funcaoAdmin(corpo) {
  const { data: s } = await sb.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-usuarios`, {
    method: 'POST', body: JSON.stringify(corpo),
    headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.mensagem || 'Erro no servidor.');
  return j;
}
const senhaAleatoria = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const v = crypto.getRandomValues(new Uint32Array(10));
  return [...v].map(x => c[x % c.length]).join('');
};

let usuarios = [];

function montar() {
  const raiz = $('#admin');
  raiz.append(
    h('header', { class: 'topo' },
      h('div', { class: 'marca' }, 'Kapuzinho 3D', h('small', {}, 'Administração')),
      h('span', { class: 'quem' }, estado.nome || estado.email),
      h('a', { class: 'btn', href: './' }, '← Voltar ao site'),
      h('button', { class: 'btn', onclick: () => sair() }, 'Sair')),
    h('main', {},
      h('section', { class: 'cartao' },
        h('h2', {}, 'Novo usuário'),
        h('form', { id: 'fNovo', class: 'grade' },
          h('label', {}, 'Nome', h('input', { name: 'nome', required: true })),
          h('label', {}, 'E-mail', h('input', { name: 'email', type: 'email', required: true })),
          h('label', {}, 'Senha', h('div', { class: 'linha' }, h('input', { name: 'senha', required: true, minlength: 8 }),
            h('button', { type: 'button', class: 'btn', onclick: e => { e.target.closest('form').senha.value = senhaAleatoria(); } }, 'Gerar'))),
          h('label', {}, 'Limite de downloads', h('input', { name: 'limite', type: 'number', min: 0, placeholder: 'padrão' })),
          h('label', {}, 'Papel', h('select', { name: 'papel' }, h('option', { value: 'usuario' }, 'Usuário'), h('option', { value: 'admin' }, 'Administrador'))),
          h('label', {}, 'Válido até (opcional)', h('input', { name: 'validade', type: 'date' })),
          h('button', { class: 'btn primario', type: 'submit' }, 'Criar usuário'))),
      h('section', { class: 'cartao' },
        h('h2', {}, 'Configurações'),
        h('form', { id: 'fConfig', class: 'grade' },
          h('label', {}, 'Limite padrão (usuários novos)', h('input', { name: 'limite', type: 'number', min: 0, required: true })),
          h('label', {}, 'Sessão livre após (minutos sem sinal)', h('input', { name: 'minutos', type: 'number', min: 1, max: 60, required: true })),
          h('label', { class: 'check' }, h('input', { name: 'novos', type: 'checkbox' }), 'Quem se cadastra sozinho (e-mail ou Google) já entra liberado (desmarcado = fica aguardando você aprovar)'),
          h('label', { class: 'check' }, h('input', { name: 'todos', type: 'checkbox' }), 'Aplicar o limite padrão a todos os usuários agora'),
          h('button', { class: 'btn primario', type: 'submit' }, 'Salvar'))),
      h('section', { class: 'cartao largo' },
        h('div', { class: 'cab' }, h('h2', {}, 'Usuários'),
          h('input', { id: 'busca', placeholder: 'Buscar por nome ou e-mail…', oninput: desenharUsuarios }),
          h('button', { class: 'btn', onclick: carregar }, '↻ Atualizar')),
        h('div', { class: 'rolagem' }, h('table', { id: 'tUsuarios' }))),
      h('section', { class: 'cartao largo' },
        h('div', { class: 'cab' }, h('h2', { id: 'tituloHist' }, 'Histórico (todos)'), h('button', { class: 'btn', onclick: () => historico(null) }, 'Ver todos')),
        h('div', { class: 'rolagem' }, h('table', { id: 'tHist' })))),
    h('div', { id: 'aviso', class: 'aviso', hidden: true }));

  $('#fNovo').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('[type=submit]'); b.disabled = true;
    try {
      await funcaoAdmin({ acao: 'criar', nome: f.nome.value, email: f.email.value, senha: f.senha.value, limite: f.limite.value, papel: f.papel.value, validade: f.validade.value || null });
      aviso(`Usuário ${f.email.value} criado. Senha: ${f.senha.value}`);
      f.reset(); await carregar();
    } catch (err) { aviso(err.message, 'erro'); }
    b.disabled = false;
  });
  $('#fConfig').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.todos.checked && !confirm(`Colocar o limite de ${f.limite.value} downloads em TODOS os usuários?`)) return;
    try { await rpc('admin_config', { p_limite_padrao: +f.limite.value, p_sessao_minutos: +f.minutos.value, p_aplicar_todos: f.todos.checked, p_novos_ativos: f.novos.checked }); aviso('Configurações salvas.'); f.todos.checked = false; await carregar(); }
    catch (err) { aviso(err.message, 'erro'); }
  });
}

async function carregarConfig() {
  const { data } = await sb.from('config').select('chave, valor');
  const c = Object.fromEntries((data || []).map(x => [x.chave, x.valor]));
  const f = $('#fConfig'); f.limite.value = c.limite_padrao ?? 5; f.minutos.value = c.sessao_minutos ?? 3; f.novos.checked = c.novos_ativos !== false;
}

async function carregar() {
  try { usuarios = await rpc('admin_listar'); desenharUsuarios(); }
  catch (err) { aviso(err.message, 'erro'); }
}

function desenharUsuarios() {
  const q = ($('#busca').value || '').toLowerCase();
  const t = $('#tUsuarios'); t.replaceChildren();
  t.append(h('tr', {}, ...['', 'Nome', 'E-mail', 'Papel', 'Ativo', 'Downloads', 'Limite', 'Validade', 'Último login', 'Ações'].map(x => h('th', {}, x))));
  const ordem = u => (!u.ativo && !u.ultimo_login ? 0 : 1);
  for (const u of [...usuarios].sort((a, b) => ordem(a) - ordem(b)).filter(u => !q || (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))) {
    const nome = h('input', { value: u.nome || '' }), papel = h('select', {}, h('option', { value: 'usuario' }, 'usuário'), h('option', { value: 'admin' }, 'admin'));
    papel.value = u.papel;
    const ativo = h('input', { type: 'checkbox' }); ativo.checked = u.ativo;
    const limite = h('input', { type: 'number', min: 0, value: u.limite_downloads, class: 'curto' });
    const validade = h('input', { type: 'date', value: u.validade || '' });
    const salvar = async () => {
      try { await rpc('admin_atualizar', { p_id: u.id, p_nome: nome.value, p_papel: papel.value, p_ativo: ativo.checked, p_limite: +limite.value, p_validade: validade.value || null }); aviso('Salvo.'); await carregar(); }
      catch (err) { aviso(err.message, 'erro'); }
    };
    const acao = (txt, fn, cls = '') => h('button', { class: `btn mini ${cls}`, onclick: fn }, txt);
    t.append(h('tr', { class: u.ativo ? '' : 'inativo' },
      h('td', { title: u.online ? `Online: ${u.sessao_info || ''} · último sinal ${dataBR(u.sessao_visto)}` : 'Offline' }, h('span', { class: `bolinha ${u.online ? 'on' : ''}` })),
      h('td', {}, nome), h('td', {}, u.email), h('td', {}, papel),
      h('td', {}, ativo, !u.ativo && !u.ultimo_login ? h('span', { class: 'selo' }, 'aguardando') : null),
      h('td', { class: u.downloads_usados >= u.limite_downloads ? 'esgotou' : '' }, `${u.downloads_usados}`),
      h('td', {}, limite), h('td', {}, validade), h('td', {}, dataBR(u.ultimo_login)),
      h('td', { class: 'acoes' },
        acao('Salvar', salvar, 'primario'),
        !u.ativo && !u.ultimo_login ? acao('Aprovar', async () => { ativo.checked = true; await salvar(); }, 'primario') : null,
        acao('+5', async () => { limite.value = +limite.value + 5; await salvar(); }),
        acao('Zerar usados', async () => { if (!confirm(`Zerar os downloads usados de ${u.email}?`)) return; try { await rpc('admin_zerar_downloads', { p_id: u.id }); aviso('Zerado.'); await carregar(); } catch (err) { aviso(err.message, 'erro'); } }),
        u.online ? acao('Derrubar sessão', async () => { try { await rpc('admin_derrubar', { p_id: u.id }); aviso('Sessão encerrada. A pessoa vai precisar entrar de novo.'); await carregar(); } catch (err) { aviso(err.message, 'erro'); } }) : null,
        acao('Senha', async () => {
          const s = prompt(`Nova senha pra ${u.email} (mínimo 8):`, senhaAleatoria());
          if (!s) return;
          try { await funcaoAdmin({ acao: 'senha', id: u.id, senha: s }); aviso(`Senha trocada: ${s}`); } catch (err) { aviso(err.message, 'erro'); }
        }),
        acao('Histórico', () => historico(u)),
        acao('Excluir', async () => {
          if (!confirm(`EXCLUIR a conta ${u.email}? Isso apaga o login e o histórico.`)) return;
          try { await funcaoAdmin({ acao: 'excluir', id: u.id }); aviso('Conta excluída.'); await carregar(); } catch (err) { aviso(err.message, 'erro'); }
        }, 'perigo'))));
  }
}

async function historico(u) {
  $('#tituloHist').textContent = u ? `Histórico de ${u.email}` : 'Histórico (todos)';
  try {
    const linhas = await rpc('admin_historico', { p_id: u ? u.id : null, p_limite: 300 });
    const t = $('#tHist'); t.replaceChildren(h('tr', {}, ...['Quando', 'Usuário', 'Evento', 'Detalhe'].map(x => h('th', {}, x))));
    for (const l of linhas) t.append(h('tr', { class: /bloqueado|negado|derrubado/.test(l.tipo) ? 'alerta' : '' }, h('td', {}, dataBR(l.quando)), h('td', {}, l.email || '—'), h('td', {}, l.tipo), h('td', {}, l.detalhe || '')));
    if (u) $('#tHist').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { aviso(err.message, 'erro'); }
}

(async () => {
  if (!REMOTO) { document.body.textContent = 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env pra usar o admin.'; return; }
  await exigirLogin({ admin: true });
  montar();
  await Promise.all([carregarConfig(), carregar(), historico(null)]);
  setInterval(carregar, 30_000);   // atualiza quem está online
})();
