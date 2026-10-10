// Controle de acesso: login (Supabase), sessão única por conta, limite de downloads.
// Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no .env o site roda em "modo local" (sem login) — só pra desenvolver.
import { createClient } from '@supabase/supabase-js';
import { linkWhatsapp, ICONE_WPP } from './contato.js';

const URL_SB = import.meta.env.VITE_SUPABASE_URL || '';
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const REMOTO = !!(URL_SB && CHAVE);
const CHAVE_SESSAO = 'kap3d_sessao';
const PULSO_MS = 60_000;

// flowType 'pkce': a volta do Google/e-mail vem com ?code=... (curto) em vez dos tokens na barra de endereço
export const sb = REMOTO ? createClient(URL_SB, CHAVE, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
// "esqueci a senha": o Supabase avisa por evento quando a pessoa volta pelo link do e-mail
let voltouPraTrocarSenha = false;
sb?.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') voltouPraTrocarSenha = true; });
// tira code/token/erros da barra de endereço depois do login (não deixa token visível nem no histórico)
function limparEndereco() {
  const temLixo = /access_token|refresh_token|error_description|type=recovery/.test(location.hash) || /[?&](code|error|error_description)=/.test(location.search);
  if (temLixo) history.replaceState(null, '', location.pathname);
}
// erro que o Google/Supabase devolve na URL (ex.: acesso negado)
function erroNaUrl() {
  const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
  const e = q.get('error_description');
  return e ? decodeURIComponent(e.replace(/\+/g, ' ')) : '';
}
export const estado = { nome: '', email: '', papel: 'usuario', restantes: null, limite: null, sessao: null };
const ouvintes = new Set();
export const aoMudar = fn => { ouvintes.add(fn); fn(estado); return () => ouvintes.delete(fn); };
const avisar = () => ouvintes.forEach(fn => fn(estado));
let timerPulso = null;

const infoNavegador = () => {
  const ua = navigator.userAgent;
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  return `${nav} · ${so} · ${screen.width}×${screen.height}`;
};

// ---------- tela de login / cadastro / Google / esqueci a senha ----------
const traduzir = m => /Invalid login/i.test(m) ? 'E-mail ou senha incorretos.'
  : /Email not confirmed/i.test(m) ? 'Confirme seu e-mail primeiro (abra o link que chegou na sua caixa de entrada).'
  : /already registered|already been registered|User already/i.test(m) ? 'Já existe uma conta com esse e-mail. Use "Entrar" ou "Esqueci a senha".'
  : /Signups not allowed|signup.*disabled/i.test(m) ? 'O cadastro está fechado. Peça acesso ao administrador.'
  : /Password should be|weak/i.test(m) ? 'Senha fraca: use pelo menos 8 caracteres.'
  : /fetch|Load failed|NetworkError/i.test(m) ? 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  : /rate|too many|security purposes/i.test(m) ? 'Muitas tentativas. Espere um pouco e tente de novo.'
  : /provider is not enabled|Unsupported provider/i.test(m) ? 'O login com Google ainda não foi ativado no servidor.' : m;

function telaLogin(mensagem = '', { titulo = 'Entrar', modo = 'entrar' } = {}) {
  return new Promise(resolver => {
    document.getElementById('telaLogin')?.remove();
    const t = document.createElement('div');
    t.id = 'telaLogin'; t.className = 'tela-login';
    t.innerHTML = `
      <form class="caixa-login" autocomplete="on" novalidate>
        <div class="marca-login">Kapuzinho 3D<small>Ferramentas STL</small></div>
        <div class="abas-login" role="tablist">
          <button type="button" data-modo="entrar">Entrar</button>
          <button type="button" data-modo="criar">Criar conta</button>
        </div>
        <h2></h2>
        <button type="button" class="btn btn-google">
          <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
          <span>Continuar com o Google</span>
        </button>
        <div class="ou"><span>ou com e-mail</span></div>
        <label class="so-criar">Seu nome<input name="nome" autocomplete="name"></label>
        <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
        <label class="campo-senha">Senha<input name="senha" type="password" minlength="8" autocomplete="current-password"></label>
        <label class="so-criar">Repita a senha<input name="senha2" type="password" minlength="8" autocomplete="new-password"></label>
        <p class="msg-login" role="alert"></p>
        <button class="btn primario enviar" type="submit">Entrar</button>
        <button type="button" class="link-login esqueci">Esqueci a senha</button>
        <p class="nota-login">Cada conta pode ficar aberta em um computador por vez.</p>
        <a class="btn btn-wpp-login" href="${linkWhatsapp()}" target="_blank" rel="noopener">${ICONE_WPP}<span>Entrar em contato pelo WhatsApp</span></a>
      </form>`;
    document.body.append(t);
    const f = t.querySelector('form'), msg = t.querySelector('.msg-login'), btn = t.querySelector('.enviar');
    const h2 = t.querySelector('h2'), lnkEsqueci = t.querySelector('.esqueci');
    let atual = modo;
    const mudarModo = m => {
      atual = m;
      t.querySelectorAll('.abas-login button').forEach(b => b.classList.toggle('ativa', b.dataset.modo === m));
      t.querySelector('.abas-login').hidden = m === 'nova-senha' || m === 'esqueci';
      t.querySelectorAll('.so-criar').forEach(e => { e.hidden = !(m === 'criar' || m === 'nova-senha'); });
      t.querySelector('label.so-criar').hidden = m !== 'criar';                       // "Seu nome" só no cadastro
      t.querySelector('.campo-senha').hidden = m === 'esqueci';
      f.email.closest('label').hidden = m === 'nova-senha';
      t.querySelector('.btn-google').hidden = t.querySelector('.ou').hidden = m === 'nova-senha' || m === 'esqueci';
      lnkEsqueci.textContent = m === 'esqueci' ? '← Voltar' : 'Esqueci a senha';
      lnkEsqueci.hidden = m === 'nova-senha' || m === 'criar';
      h2.textContent = { entrar: titulo, criar: 'Criar conta', esqueci: 'Recuperar senha', 'nova-senha': 'Nova senha' }[m];
      btn.textContent = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link por e-mail', 'nova-senha': 'Salvar nova senha' }[m];
      f.senha.autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
      msg.textContent = ''; msg.className = 'msg-login';
    };
    const dizer = (texto, ok = false) => { msg.textContent = texto; msg.className = ok ? 'msg-login ok' : 'msg-login'; };
    t.querySelectorAll('.abas-login button').forEach(b => b.addEventListener('click', () => mudarModo(b.dataset.modo)));
    lnkEsqueci.addEventListener('click', () => mudarModo(atual === 'esqueci' ? 'entrar' : 'esqueci'));
    mudarModo(modo);
    dizer(mensagem);

    t.querySelector('.btn-google').addEventListener('click', async () => {
      dizer('Abrindo o Google…', true);
      // volta pra esta mesma página; a sessão única é aberta quando voltar (exigirLogin)
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (error) dizer(traduzir(error.message));
    });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.email.value.trim(), senha = f.senha.value;
      if (atual !== 'nova-senha' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return dizer('Digite um e-mail válido.');
      if ((atual === 'criar' || atual === 'nova-senha') && senha.length < 8) return dizer('A senha precisa ter pelo menos 8 caracteres.');
      if ((atual === 'criar' || atual === 'nova-senha') && senha !== f.senha2.value) return dizer('As duas senhas não são iguais.');
      if (atual === 'criar' && !f.nome.value.trim()) return dizer('Digite seu nome.');
      btn.disabled = true;
      try {
        if (atual === 'esqueci') {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
          if (error) return dizer(traduzir(error.message));
          return dizer('Se esse e-mail tiver conta, chegou um link pra criar uma nova senha. Confira também o spam.', true);
        }
        if (atual === 'nova-senha') {
          const { error } = await sb.auth.updateUser({ password: senha });
          if (error) return dizer(traduzir(error.message));
          dizer('Senha trocada! Entrando…', true);
        } else if (atual === 'criar') {
          dizer('Criando a conta…', true);
          const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: f.nome.value.trim() }, emailRedirectTo: location.origin + location.pathname } });
          if (error) return dizer(traduzir(error.message));
          if (!data.session) { mudarModo('entrar'); f.email.value = email; return dizer('Conta criada! Abra o link de confirmação que chegou no seu e-mail e depois entre aqui.', true); }
        } else {
          dizer('Entrando…', true);
          const { error } = await sb.auth.signInWithPassword({ email, password: senha });
          if (error) return dizer(traduzir(error.message));
        }
        const r = await abrirSessao();
        if (!r.ok) { dizer(r.mensagem); await sb.auth.signOut(); return; }
        t.remove(); resolver(true);
      } finally { btn.disabled = false; }
    });
  });
}

async function abrirSessao() {
  const anterior = localStorage.getItem(CHAVE_SESSAO);
  const { data, error } = await sb.rpc('iniciar_sessao', { p_info: infoNavegador(), p_sessao_atual: anterior });
  if (error) return { ok: false, codigo: error.message, mensagem: error.hint || error.message };
  localStorage.setItem(CHAVE_SESSAO, data.sessao);
  const { data: u } = await sb.auth.getUser();
  Object.assign(estado, { sessao: data.sessao, nome: data.nome, papel: data.papel, restantes: data.restantes, limite: data.limite, email: u?.user?.email || '' });
  avisar();
  iniciarPulso();
  return { ok: true };
}

function iniciarPulso() {
  clearInterval(timerPulso);
  timerPulso = setInterval(pulso, PULSO_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pulso(); });
}

async function pulso() {
  if (!estado.sessao) return;
  const { data, error } = await sb.rpc('pulso', { p_sessao: estado.sessao });
  if (error) return;                                  // sem internet: tenta de novo no próximo
  if (!data.ok) return sessaoPerdida('Sua sessão foi encerrada (a conta foi aberta em outro lugar, desativada ou o administrador encerrou). Entre de novo.');
  estado.restantes = data.restantes; estado.limite = data.limite; avisar();
}

async function sessaoPerdida(mensagem) {
  clearInterval(timerPulso);
  estado.sessao = null; localStorage.removeItem(CHAVE_SESSAO);
  await sb.auth.signOut();
  avisar();
  await telaLogin(mensagem, { titulo: 'Sessão encerrada' });
}

// chamado no início do site. Resolve quando há uma sessão válida (ou direto, no modo local)
export async function exigirLogin({ admin = false } = {}) {
  if (!REMOTO) { Object.assign(estado, { nome: 'modo local', papel: 'admin' }); avisar(); return; }
  const recuperandoAntigo = /type=recovery/.test(location.hash);
  const erroVolta = erroNaUrl();
  const { data } = await sb.auth.getSession();          // aqui o supabase já trocou o ?code= pela sessão
  limparEndereco();
  if (data.session && (voltouPraTrocarSenha || recuperandoAntigo)) {
    await telaLogin('Crie sua nova senha.', { modo: 'nova-senha' });
  } else if (!data.session && erroVolta) {
    await telaLogin(traduzir(erroVolta));
  } else if (data.session) {
    const r = await abrirSessao();
    if (!r.ok) { await sb.auth.signOut(); await telaLogin(r.mensagem); }
  } else await telaLogin();
  if (admin && estado.papel !== 'admin') {
    document.body.innerHTML = '<p style="padding:40px;font:16px sans-serif">Esta página é só para administradores. <a href="./">Voltar</a></p>';
    throw new Error('sem permissão');
  }
}

export async function sair() {
  if (!REMOTO) return;
  clearInterval(timerPulso);
  if (estado.sessao) await sb.rpc('encerrar_sessao', { p_sessao: estado.sessao });
  localStorage.removeItem(CHAVE_SESSAO);
  estado.sessao = null;
  await sb.auth.signOut();
  location.reload();
}

// ---------- download: o arquivo é montado no servidor, que confere sessão e limite ----------
function paraPartes(itens) {
  return itens.map((it, i) => {
    const g = it.geom, pos = g.attributes.position.array;
    let idx = g.index?.array;
    if (!idx) { idx = new Uint32Array(pos.length / 3); for (let k = 0; k < idx.length; k++) idx[k] = k; }
    return { nome: it.nome || `peca_${i + 1}.stl`, cor: it.cor ?? null, pos: pos instanceof Float32Array ? pos : new Float32Array(pos), idx: idx instanceof Uint32Array ? idx : new Uint32Array(idx) };
  });
}

function salvar(bytes, tipo, nome) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function avisoTela(texto, tipo = 'info') {
  let t = document.getElementById('avisoAcesso');
  if (!t) { t = document.createElement('div'); t.id = 'avisoAcesso'; document.body.append(t); }
  t.className = `aviso-acesso ${tipo}`; t.textContent = texto; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, tipo === 'erro' ? 9000 : 4500);
}

export async function exportar(formato, nome, itens, opcoes = {}) {
  const partes = paraPartes(itens);
  // modo local de desenvolvimento (sem servidor). A condição usa a variável do .env direto pra que,
  // no build de produção, o Vite apague este trecho e o gerador de arquivos NÃO vá pro navegador.
  if (!import.meta.env.VITE_SUPABASE_URL) {
    const [{ montarPacote, lerPacote, empacotar }, JSZip, CONFIG, PERFIS] = await Promise.all([
      import('../../supabase/functions/_shared/empacotar.js'), import('jszip').then(m => m.default), import('../../supabase/functions/_shared/bambu-a1-projeto.json').then(m => m.default),
      import('../../supabase/functions/_shared/bambu-perfis.json').then(m => m.default)]);
    const p = lerPacote(montarPacote({ formato, nome, opcoes }, partes));
    const arq = await empacotar(JSZip, CONFIG, p.meta, p.partes, PERFIS);
    return salvar(arq.bytes, arq.tipo, arq.nome);
  }
  if (estado.restantes !== null && estado.restantes <= 0) {
    avisoTela('Você atingiu o limite de downloads. Fale com o administrador pra liberar mais.', 'erro');
    return;
  }
  const { montarPacote } = await import('../../supabase/functions/_shared/pacote.js');
  const corpo = montarPacote({ formato, nome, opcoes }, partes);
  const { data: s } = await sb.auth.getSession();
  avisoTela('Preparando o arquivo…');
  let r;
  try {
    r = await fetch(`${URL_SB}/functions/v1/exportar`, {
      method: 'POST', body: corpo,
      headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: CHAVE, 'x-sessao': estado.sessao || '', 'Content-Type': 'application/octet-stream' },
    });
  } catch { return avisoTela('Sem conexão com o servidor. Tente de novo.', 'erro'); }
  if (!r.ok) {
    let e = {}; try { e = await r.json(); } catch {}
    if (e.erro === 'SESSAO_INVALIDA' || r.status === 401) return sessaoPerdida(e.mensagem || 'Entre de novo pra baixar.');
    if (e.erro === 'LIMITE') { estado.restantes = 0; avisar(); }
    return avisoTela(e.mensagem || 'Não foi possível baixar agora.', 'erro');
  }
  const restantes = r.headers.get('x-restantes');
  if (restantes !== null && restantes !== '') { estado.restantes = +restantes; estado.limite = +(r.headers.get('x-limite') || estado.limite); avisar(); }
  const nomeArq = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || nome;
  salvar(new Uint8Array(await r.arrayBuffer()), r.headers.get('content-type') || 'application/octet-stream', nomeArq);
  avisoTela(`Download feito. ${estado.restantes} restante(s).`, 'ok');
}
