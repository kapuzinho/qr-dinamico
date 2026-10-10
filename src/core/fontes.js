// Fontes: embutidas (OFL, em /fontes), do Windows (Local Font Access API) e arquivos .ttf/.otf enviados
import opentype from 'opentype.js';
import { el } from './ui.js';

const EMBUTIDAS = [
  ['Poppins', 'Poppins-Regular.ttf'], ['Poppins Bold', 'Poppins-Bold.ttf'], ['Poppins Black', 'Poppins-Black.ttf'],
  ['Montserrat', 'Montserrat-Variavel.ttf'], ['Oswald', 'Oswald-Variavel.ttf'], ['Anton', 'Anton-Regular.ttf'],
  ['Bebas Neue', 'BebasNeue-Regular.ttf'], ['Alfa Slab One', 'AlfaSlabOne-Regular.ttf'], ['Black Ops One', 'BlackOpsOne-Regular.ttf'],
  ['Righteous', 'Righteous-Regular.ttf'], ['Bangers', 'Bangers-Regular.ttf'], ['Cinzel', 'Cinzel-Variavel.ttf'],
  ['Pacifico', 'Pacifico-Regular.ttf'], ['Lobster', 'Lobster-Regular.ttf'], ['Great Vibes', 'GreatVibes-Regular.ttf'],
  ['Dancing Script', 'DancingScript-Variavel.ttf'], ['Kaushan Script', 'KaushanScript-Regular.ttf'],
  ['Satisfy', 'Satisfy-Regular.ttf'], ['Permanent Marker', 'PermanentMarker-Regular.ttf'],
];

const lista = [];
const cache = new Map();
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(f => f());

export function iniciarFontes() {
  for (const [nome, arq] of EMBUTIDAS) {
    const familiaCss = `K3D ${nome}`;
    try { document.fonts.add(new FontFace(familiaCss, `url(/fontes/${arq})`)); } catch { /* sem prévia */ }
    lista.push({ id: `emb:${arq}`, nome, familiaCss, origem: 'Embutida', carregar: () => fetch(`/fontes/${arq}`).then(r => r.arrayBuffer()) });
  }
}

export const listarFontes = () => lista;
export const nomeDaFonte = id => lista.find(f => f.id === id)?.nome || id;

export async function carregarFontesDoSistema() {
  if (!('queryLocalFonts' in window)) throw new Error('Este navegador não deixa ler as fontes do Windows. Use Chrome ou Edge, ou adicione o arquivo .ttf.');
  const fontes = await window.queryLocalFonts();
  const vistos = new Set(lista.map(f => f.id));
  for (const f of fontes) {
    const id = `loc:${f.postscriptName}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const estilo = (f.style || '').toLowerCase();
    lista.push({
      id, nome: f.fullName, familiaCss: f.family, origem: 'Windows',
      peso: /bold|black|heavy/.test(estilo) ? 700 : 400, italico: /italic|oblique/.test(estilo),
      carregar: async () => (await f.blob()).arrayBuffer(),
    });
  }
  avisar();
  return fontes.length;
}

export async function adicionarArquivoFonte(arquivo) {
  const buf = await arquivo.arrayBuffer();
  const nome = arquivo.name.replace(/\.(ttf|otf)$/i, '');
  const id = `arq:${nome}`;
  const familiaCss = `K3D arquivo ${nome}`;
  try { const ff = new FontFace(familiaCss, buf); await ff.load(); document.fonts.add(ff); } catch { /* sem prévia */ }
  if (!lista.some(f => f.id === id)) lista.push({ id, nome, familiaCss, origem: 'Arquivo', carregar: async () => buf });
  avisar();
  return id;
}

export async function obterFonte(id) {
  if (cache.has(id)) return cache.get(id);
  const item = lista.find(f => f.id === id) || lista[0];
  const buf = await item.carregar();
  const tag = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (tag === 'ttcf') throw new Error(`"${item.nome}" vem num arquivo de coleção (.ttc), que não dá pra ler. Escolha outra fonte.`);
  if (tag === 'wOF2') throw new Error(`"${item.nome}" está em WOFF2, que não dá pra ler. Use a versão .ttf ou .otf.`);
  const font = opentype.parse(buf);
  cache.set(id, font);
  return font;
}

// seletor que mostra cada fonte escrita nela mesma
export function seletorFonte(pai, rotulo, idInicial, { dica, aoMudar } = {}) {
  let atual = idInicial;
  const btn = el('button', { type: 'button', class: 'fonte-atual' });
  const pop = el('div', { class: 'pop-fontes' });
  pop.hidden = true;
  const busca = el('input', { type: 'search', placeholder: 'Procurar fonte…' });
  const itens = el('div', { class: 'lista-fontes' });
  const msg = el('p', { class: 'nota' });
  const inpArq = el('input', { type: 'file', accept: '.ttf,.otf', hidden: true });
  pop.append(busca, itens,
    el('div', { class: 'acoes' },
      el('button', { type: 'button', class: 'btn pequeno', text: 'Carregar fontes do Windows', onclick: async () => {
        try { msg.textContent = `${await carregarFontesDoSistema()} fontes encontradas.`; } catch (e) { msg.textContent = e.message; }
      } }),
      el('button', { type: 'button', class: 'btn pequeno', text: 'Adicionar .ttf/.otf', onclick: () => inpArq.click() })),
    msg, inpArq);
  inpArq.addEventListener('change', async () => { if (inpArq.files[0]) escolher(await adicionarArquivoFonte(inpArq.files[0])); });

  const estilo = f => `font-family: "${f.familiaCss}", sans-serif; font-weight: ${f.peso || 400}; font-style: ${f.italico ? 'italic' : 'normal'}`;
  function desenharBotao() {
    const f = lista.find(x => x.id === atual) || lista[0];
    if (!f) return;
    btn.textContent = f.nome;
    btn.style.cssText = estilo(f);
  }
  function desenharLista() {
    const q = busca.value.trim().toLowerCase();
    const filtradas = lista.filter(f => !q || f.nome.toLowerCase().includes(q)).slice(0, 400);
    itens.replaceChildren(...filtradas.map(f => el('button', {
      type: 'button', class: f.id === atual ? 'item-fonte ativa' : 'item-fonte', style: estilo(f), text: f.nome, title: f.origem, onclick: () => escolher(f.id),
    })));
  }
  function escolher(id) {
    atual = id;
    pop.hidden = true;
    desenharBotao();
    aoMudar?.(id);
  }
  btn.addEventListener('click', () => { pop.hidden = !pop.hidden; if (!pop.hidden) { desenharLista(); busca.focus(); } });
  busca.addEventListener('input', desenharLista);
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) pop.hidden = true; });
  ouvintes.add(() => { desenharBotao(); if (!pop.hidden) desenharLista(); });

  const lab = el('div', { class: 'campo campo-fonte' }, el('span', { class: 'rotulo', text: rotulo }), btn, pop);
  if (dica) { lab.dataset.dica = dica; lab.classList.add('com-dica'); }
  pai.append(lab);
  desenharBotao();
  const f = () => atual;
  f.input = btn;
  f.definir = id => { if (lista.some(x => x.id === id)) escolher(id); };
  return f;
}
