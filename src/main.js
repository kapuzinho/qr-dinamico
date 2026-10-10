import './style.css';
import { iniciarMotor, paraManifold, assentar, volumeDe } from './core/motor.js';
import { Visualizador } from './core/visualizador.js';
import { lerSTL, baixarSTL, baixarZip } from './core/arquivos.js';
import { el, ativarSlidersAuto } from './core/ui.js';
import { iniciarFontes } from './core/fontes.js';
import abas from './abas/index.js';
import modelos from './modelos/index.js';
import { Editor2D } from './core/editor2d.js';
import { exigirLogin, aoMudar as aoMudarConta, sair, REMOTO } from './core/acesso.js';
import { linkWhatsapp, ICONE_WPP } from './core/contato.js';
{ const w = document.getElementById('btnWpp'); if (w) { w.href = linkWhatsapp(); w.innerHTML = ICONE_WPP + '<span>WhatsApp</span>'; } }

const $ = id => document.getElementById(id);
const MESAS = [
  ['256,256,256', 'Bambu X1 / P1 / A1'],
  ['180,180,180', 'Bambu A1 mini'],
  ['350,320,325', 'Bambu H2D'],
  ['220,220,250', 'Ender 3'],
  ['300,300,300', 'Mesa 300 × 300'],
];

const viewer = new Visualizador($('viewport'));
const editor2d = new Editor2D($('editor2d'));
{ // esconde o aviso "arraste um STL" sempre que alguma coisa estiver na tela (prévias do letreiro, placas etc.)
  const mostrar = viewer.mostrar.bind(viewer);
  viewer.mostrar = (itens, o) => { $('vazio').hidden = !!ctx.peca || itens.length > 0; mostrar(itens, o); };
}
const pilha = [];      // desfazer: [{ peca, rotulo }]
const refazer = [];    // refazer:  [{ peca, rotulo }]
const MAX_HIST = 30;
let cacheManifold = null;
let abaAtiva = null;
// ferramentas que funcionam sem um STL aberto (criam coisa nova ou carregam os próprios arquivos)
const SEM_STL = new Set(['juntar', 'letreiro', 'qrcode', 'etiqueta', 'tag-chaveiro']);
const precisaStl = aba => aba.grupo !== 'Modelos' && !SEM_STL.has(aba.id);
const DICA_STL = 'Abra um STL primeiro: clique em "Abrir STL" ou arraste o arquivo pra área 3D.';
function atualizarMenu() {
  for (const aba of [...abas, ...modelos]) {
    if (!aba.botao) continue;
    const bloq = precisaStl(aba) && !ctx.peca;
    aba.botao.classList.toggle('bloqueada', bloq);
    aba.botao.setAttribute('aria-disabled', String(bloq));
    if (bloq) aba.botao.dataset.dica = DICA_STL; else delete aba.botao.dataset.dica;
  }
}
// balãozinho ao passar o mouse numa ferramenta bloqueada (fixo na tela, não é cortado pela rolagem do menu)
function ligarDicaMenu(trilho) {
  const dica = el('div', { class: 'dica-flutuante', role: 'tooltip' }); dica.hidden = true;
  document.body.append(dica);
  trilho.addEventListener('mouseover', e => {
    const b = e.target.closest('.item-aba.bloqueada');
    if (!b) { dica.hidden = true; return; }
    dica.textContent = b.dataset.dica; dica.hidden = false;
    const r = b.getBoundingClientRect(), w = dica.offsetWidth, h = dica.offsetHeight;
    const cabe = r.right + 10 + w < innerWidth;
    dica.style.left = (cabe ? r.right + 10 : Math.max(8, r.left)) + 'px';
    dica.style.top = (cabe ? r.top + r.height / 2 - h / 2 : r.bottom + 6) + 'px';
  });
  trilho.addEventListener('mouseleave', () => { dica.hidden = true; });
}
function chamarAbrirStl() {
  const b = document.querySelector('label[for="arquivo"]');
  if (!b) return;
  b.classList.remove('chamar'); void b.offsetWidth; b.classList.add('chamar');
}

const ctx = {
  viewer,
  mesa: { x: 256, y: 256, z: 256 },
  peca: null,
  deslocamentoCarga: null,
  abaAtiva: null,
  fatiamento: null,
  temPeca() {
    if (!this.peca) this.log('Abra um arquivo STL primeiro.', 'erro');
    return !!this.peca;
  },
  definirPeca(geom, { historico = true, nome, enquadrar = false } = {}) {
    if (historico && this.peca) {
      pilha.push({ peca: this.peca, rotulo: abaAtiva?.nome || 'modificação' });
      if (pilha.length > MAX_HIST) pilha.shift();
      refazer.length = 0;   // mudança nova apaga o que dava pra refazer
    }
    this.peca = { geom, nome: nome || this.peca?.nome || 'peca.stl' };
    cacheManifold?.delete();
    cacheManifold = null;
    viewer.limparExtras();
    viewer.mostrar([{ geom }], { enquadrar });
    atualizarInfo();
    atualizarMenu();
  },
  // sem peça aberta, limpa a tela (senão fica o que a aba anterior desenhou, ex.: um modelo)
  mostrarAtual() { viewer.mostrar(this.peca ? [{ geom: this.peca.geom }] : []); },
  manifold() {
    if (!cacheManifold) cacheManifold = paraManifold(this.peca.geom);
    return cacheManifold;
  },
  nomeBase() { return (this.peca?.nome || 'peca').replace(/\.stl$/i, ''); },
  async ocupado(msg, fn) {
    const o = $('ocupado');
    o.querySelector('span').textContent = msg;
    o.hidden = false;
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    try { return await fn(); }
    catch (e) { console.error(e); this.log(e.message || String(e), 'erro'); }
    finally { o.hidden = true; }
  },
  log(msg, tipo = 'info') { const l = $('log'); l.textContent = msg; l.className = `log ${tipo}`; },
  // prévia 2D (etiquetas) por cima da área 3D
  previa2D(canvas, legenda = '') {
    const p = $('previa2d');
    if (!canvas) { p.hidden = true; p.replaceChildren(); return; }
    p.hidden = false;
    p.replaceChildren(canvas, el('span', { text: legenda }));
  },
  // ---- suporte aos modelos paramétricos (editor 2D) ----
  barra2D() { const b = $('editorTopo'); b.hidden = false; return b; },
  esconderBarra2D() { $('editorTopo').hidden = true; },
  canvas2D() { return editor2d.canvas; },
  desenhar2D(comp, cores, cb) { $('editor2d').hidden = false; editor2d.desenhar(comp, cores, cb); },
  limpar2D() { editor2d.limpar(); },
  mostrarEditor2D(mostrar) { $('editor2d').hidden = !mostrar; },
  baixarSTL,
  baixarZip,
};

function atualizarInfo() {
  $('vazio').hidden = !!ctx.peca;
  atualizarHistorico();
  $('btnBaixar').disabled = !ctx.peca;
  const info = $('infoPeca');
  if (!ctx.peca) { info.hidden = true; return; }
  const g = ctx.peca.geom;
  g.computeBoundingBox();
  const b = g.boundingBox;
  let vol = 'malha aberta';
  try { vol = `${(volumeDe(ctx.manifold()) / 1000).toFixed(1).replace('.', ',')} cm³`; } catch { /* aberta */ }
  info.hidden = false;
  info.replaceChildren(
    el('strong', { text: ctx.peca.nome }),
    el('span', { text: `${(b.max.x - b.min.x).toFixed(1)} × ${(b.max.y - b.min.y).toFixed(1)} × ${(b.max.z - b.min.z).toFixed(1)} mm` }),
    el('span', { text: `${(g.index.count / 3).toLocaleString('pt-BR')} triângulos` }),
    el('span', { text: vol }),
  );
}

async function carregar(arquivo) {
  if (!arquivo || !/\.stl$/i.test(arquivo.name)) return ctx.log('Escolha um arquivo .stl.', 'erro');
  await ctx.ocupado(`Abrindo ${arquivo.name}…`, async () => {
    const g = assentar(await lerSTL(arquivo), ctx.mesa);
    ctx.deslocamentoCarga = g.userData.deslocamento;
    pilha.length = 0; refazer.length = 0;
    ctx.definirPeca(g, { historico: false, nome: arquivo.name, enquadrar: true });
    // abriu um STL estando num modelo: vai pra primeira ferramenta pra pessoa já ver a peça
    if (!abaAtiva || abaAtiva.grupo === 'Modelos') ativarAba(abas[0]);
    else abaAtiva.ativar?.(ctx);
    ctx.log(`${arquivo.name} aberto.`, 'ok');
  });
}

function atualizarHistorico() {
  const d = $('btnDesfazer'), r = $('btnRefazer');
  d.disabled = !pilha.length; r.disabled = !refazer.length;
  $('btnOriginal').disabled = !pilha.length;
  $('btnLimpar').disabled = !ctx.peca;
  d.textContent = pilha.length ? `↶ Desfazer (${pilha.length})` : '↶ Desfazer';
  d.title = pilha.length ? `Desfazer: ${pilha[pilha.length - 1].rotulo} (Ctrl+Z). Faltam ${pilha.length} passo(s) até a peça original.` : 'Nada pra desfazer';
  r.title = refazer.length ? `Refazer: ${refazer[refazer.length - 1].rotulo} (Ctrl+Y)` : 'Nada pra refazer';
}
function trocarPara(item, { log } = {}) {
  ctx.definirPeca(item.peca.geom, { historico: false, nome: item.peca.nome });
  if (abaAtiva && abaAtiva.grupo !== 'Modelos') abaAtiva.ativar?.(ctx);
  if (log) ctx.log(log);
}
function desfazer() {
  const ant = pilha.pop();
  if (!ant) return;
  refazer.push({ peca: ctx.peca, rotulo: ant.rotulo });
  trocarPara(ant, { log: `Desfeito: ${ant.rotulo}.` + (pilha.length ? ` (${pilha.length} passo(s) ainda dá pra desfazer)` : ' Esta é a peça original.') });
}
function refazerUm() {
  const prox = refazer.pop();
  if (!prox) return;
  pilha.push({ peca: ctx.peca, rotulo: prox.rotulo });
  trocarPara(prox, { log: `Refeito: ${prox.rotulo}.` });
}
function voltarOriginal() {
  if (!pilha.length) return;
  const n = pilha.length;
  // empilha tudo no refazer, na ordem certa, pra dar pra refazer passo a passo depois
  let atual = ctx.peca;
  while (pilha.length) { const ant = pilha.pop(); refazer.push({ peca: atual, rotulo: ant.rotulo }); atual = ant.peca; }
  trocarPara({ peca: atual }, { log: `Voltou pra peça original (${n} modificação(ões) desfeita(s)). Dá pra refazer uma a uma.` });
}
function limparPeca() {
  if (!ctx.peca) return;
  if (pilha.length && !confirm('Fechar a peça? As modificações não salvas (Baixar STL) serão perdidas.')) return;
  pilha.length = 0; refazer.length = 0;
  ctx.peca = null; ctx.deslocamentoCarga = null;
  cacheManifold?.delete(); cacheManifold = null;
  viewer.limparExtras(); viewer.desativarSelecao(); viewer.mostrar([]);
  atualizarInfo(); atualizarMenu();
  // a ferramenta aberta precisa de STL? vai pro primeiro modelo
  if (abaAtiva && precisaStl(abaAtiva)) ativarAba(modelos[0]);
  else abaAtiva?.ativar?.(ctx);
  ctx.log('Peça fechada. Abra outro STL ou escolha um modelo.');
}

function ativarAba(aba) {
  if (precisaStl(aba) && !ctx.peca) {
    ctx.log(DICA_STL, 'erro');
    chamarAbrirStl();
    return;
  }
  if (abaAtiva) {
    abaAtiva.desativar?.(ctx);
    abaAtiva.painel.hidden = true;
    abaAtiva.botao.classList.remove('ativa');
    abaAtiva.botao.removeAttribute('aria-current');
  }
  // limpeza completa da tela ao trocar de ferramenta
  viewer.desativarSelecao();
  viewer.aoClicarObjeto = null;
  viewer.limparExtras();
  viewer.definirCorte(false);
  viewer.definirAramado(false);
  editor2d.limpar();
  ctx.previa2D(null);
  $('editor2d').hidden = true;
  $('editorTopo').hidden = true;

  abaAtiva = aba;
  ctx.abaAtiva = aba;
  // limpa textos de resultado antigos do painel que vai aparecer
  aba.painel.querySelectorAll('.saida').forEach(e => { e.innerHTML = ''; });
  aba.painel.hidden = false;
  aba.botao.classList.add('ativa');
  aba.botao.setAttribute('aria-current', 'page');
  // modelos cuidam da própria tela no ativar(); as demais mostram a peça STL aberta
  if (aba.grupo !== 'Modelos') ctx.mostrarAtual();
  else viewer.mostrar([]);
  aba.ativar?.(ctx);
}

function montarInterface() {
  const trilho = $('trilho'), painel = $('painel');
  const grupos = new Map();
  for (const aba of [...abas, ...modelos]) {
    if (!grupos.has(aba.grupo)) grupos.set(aba.grupo, []);
    grupos.get(aba.grupo).push(aba);
    const corpo = el('div', { class: 'corpo' });
    aba.painel = el('section', { class: 'aba-painel' }, el('h2', { text: aba.nome }), el('p', { class: 'descricao', text: aba.descricao }), corpo);
    aba.painel.hidden = true;
    ativarSlidersAuto(aba.grupo === 'Personalizar' || aba.grupo === 'Produção');
    aba.montar(corpo, ctx);
    ativarSlidersAuto(false);
    painel.append(aba.painel);
  }
  // busca no menu: digita "wifi", "foto", "pet"... e só aparecem as ferramentas/modelos que batem
  const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const busca = el('input', { class: 'busca-menu', type: 'search', placeholder: '🔎 Buscar ferramenta ou modelo…' });
  trilho.append(busca);
  const titulos = [];
  for (const [nome, lista] of grupos) {
    const h = el('h3', { text: nome });
    trilho.append(h);
    titulos.push([h, lista]);
    for (const aba of lista) {
      aba.botao = el('button', { class: 'item-aba', text: aba.nome, onclick: () => ativarAba(aba) });
      aba.botao.dataset.busca = semAcento(`${aba.nome} ${aba.descricao || ''} ${aba.id}`);
      trilho.append(aba.botao);
    }
  }
  busca.addEventListener('input', () => {
    const q = semAcento(busca.value.trim());
    for (const [h, lista] of titulos) {
      let algum = false;
      for (const aba of lista) { const ok = !q || aba.botao.dataset.busca.includes(q); aba.botao.hidden = !ok; algum ||= ok; }
      h.hidden = !algum;
    }
  });

  const vistas = $('vistas');
  for (const [v, t] of [['iso', '3D'], ['cima', 'Cima'], ['frente', 'Frente'], ['direita', 'Direita'], ['esquerda', 'Esquerda'], ['tras', 'Trás'], ['baixo', 'Baixo']])
    vistas.append(el('button', { text: t, onclick: () => viewer.vista(v) }));
  const alternar = (t, fn) => { const b = el('button', { text: t, class: 'alternar', 'aria-pressed': 'false' }); b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); fn(on); }); vistas.append(b); };
  alternar('Aramado', on => viewer.definirAramado(on));
  alternar('Corte', on => viewer.definirCorte(on));

  const sel = $('selMesa');
  for (const [v, t] of MESAS) sel.append(el('option', { value: v, text: t }));
  sel.addEventListener('change', () => {
    const [x, y, z] = sel.value.split(',').map(Number);
    ctx.mesa = { x, y, z };
    viewer.definirMesa(x, y);
    if (ctx.peca) ctx.definirPeca(assentar(ctx.peca.geom.clone(), ctx.mesa), { historico: false, enquadrar: true });
  });

  $('arquivo').addEventListener('change', e => { carregar(e.target.files[0]); e.target.value = ''; });
  $('btnDesfazer').addEventListener('click', desfazer);
  $('btnRefazer').addEventListener('click', refazerUm);
  $('btnOriginal').addEventListener('click', voltarOriginal);
  $('btnLimpar').addEventListener('click', limparPeca);
  $('btnBaixar').addEventListener('click', () => ctx.peca && baixarSTL(ctx.peca.geom, `${ctx.nomeBase()}_editado.stl`));
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); refazerUm(); }
  });

  const palco = $('palco');
  palco.addEventListener('dragover', e => { e.preventDefault(); palco.classList.add('soltando'); });
  palco.addEventListener('dragleave', () => palco.classList.remove('soltando'));
  palco.addEventListener('drop', e => { e.preventDefault(); palco.classList.remove('soltando'); carregar(e.dataTransfer.files[0]); });

  ligarDicaMenu(trilho);
  atualizarMenu();
  // sem STL aberto, começa pelo primeiro modelo (já mostra algo em 3D); com STL, pela primeira ferramenta
  ativarAba(ctx.peca ? abas[0] : modelos[0]);
}

// área da conta no topo: nome, downloads restantes, admin e sair
function montarConta() {
  if (!REMOTO) return;
  const topo = document.querySelector('.topo');
  const caixa = el('div', { class: 'conta' });
  const nome = el('span', { class: 'conta-nome' });
  const cota = el('span', { class: 'conta-cota', title: 'Downloads que ainda dá pra fazer (.3mf, .zip e .stl)' });
  const admin = el('a', { class: 'btn', href: 'admin.html', text: 'Admin', target: '_blank' }); admin.hidden = true;
  const btnSair = el('button', { class: 'btn', type: 'button', text: 'Sair', onclick: () => sair() });
  caixa.append(nome, cota, admin, btnSair);
  topo.append(caixa);
  aoMudarConta(e => {
    nome.textContent = e.nome || e.email || '';
    cota.textContent = e.restantes === null ? '' : `⬇ ${e.restantes}/${e.limite}`;
    cota.classList.toggle('acabou', e.restantes === 0);
    admin.hidden = e.papel !== 'admin';
  });
}

(async () => {
  try {
    await exigirLogin();          // tela de login + sessão única (no modo local, passa direto)
    montarConta();
    await iniciarMotor();
    iniciarFontes();
    montarInterface();
    ctx.log('Pronto. Escolha um modelo ou abra um STL pra usar as ferramentas.');
  } catch (e) {
    console.error(e);
    ctx.log(`Não foi possível carregar o motor 3D: ${e.message}`, 'erro');
  }
})();
