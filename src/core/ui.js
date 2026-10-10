// Construtores de formulário pros painéis das ferramentas
export function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos) if (f !== null && f !== undefined && f !== '') e.append(f);
  return e;
}

function linha(pai, rotulo, dica, controle, bloco = false) {
  const lab = el('label', { class: bloco ? 'campo campo-bloco' : 'campo' }, el('span', { class: 'rotulo', text: rotulo }), controle);
  if (dica) { lab.dataset.dica = dica; lab.classList.add('com-dica'); }
  pai.append(lab);
  return lab;
}

const avisar = inp => { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };

// quando ligado, numero() vira slider+caixinha automaticamente (usado em Personalizar/Produção)
let NUM_COM_SLIDER = false;
export const ativarSlidersAuto = (on) => { NUM_COM_SLIDER = on; };

export function numero(pai, rotulo, valor, { passo = 0.1, min, max, dica, un } = {}) {
  // slider automático: deriva uma faixa razoável a partir do valor quando não há min/max
  if (NUM_COM_SLIDER) {
    const vmin = (min !== undefined) ? min : (valor < 0 ? valor * 2 : 0);
    const topo = Math.max(Math.abs(valor), passo * 10, 1);
    const vmax = (max !== undefined) ? max : Math.ceil(topo * 4);
    return deslizante(pai, rotulo, valor, { min: vmin, max: vmax, passo, un, dica });
  }
  const inp = el('input', { type: 'number', step: passo, value: valor, min, max });
  linha(pai, rotulo, dica, el('span', { class: 'entrada' }, inp, un ? el('span', { class: 'un', text: un }) : null));
  const f = () => {
    const v = parseFloat(String(inp.value).replace(',', '.'));
    return Number.isFinite(v) ? v : valor;
  };
  f.input = inp;
  f.definir = v => { inp.value = v; avisar(inp); };
  return f;
}

export function campoTexto(pai, rotulo, valor, { dica, placeholder } = {}) {
  const inp = el('input', { type: 'text', value: valor, placeholder });
  linha(pai, rotulo, dica, inp);
  const f = () => inp.value;
  f.input = inp;
  f.definir = v => { inp.value = v; avisar(inp); };
  return f;
}

export function areaTexto(pai, rotulo, valor, { dica, linhas = 2 } = {}) {
  const t = el('textarea', { rows: linhas });
  t.value = valor;
  linha(pai, rotulo, dica, t, true);
  const f = () => t.value;
  f.input = t;
  f.definir = v => { t.value = v; avisar(t); };
  return f;
}

export function deslizante(pai, rotulo, valor, { min = 0, max = 100, passo = 0.1, un, dica, aoMudar } = {}) {
  const range = el('input', { type: 'range', min, max, step: passo, value: valor });
  const box = el('input', { type: 'number', step: passo, min, max, value: valor, class: 'num-mini' });
  const un2 = un ? el('span', { class: 'un', text: un }) : null;
  const sinc = (fonte, alvo) => { const v = parseFloat(String(fonte.value).replace(',', '.')); if (Number.isFinite(v)) alvo.value = v; };
  const disparar = () => aoMudar?.();
  range.addEventListener('input', () => { sinc(range, box); disparar(); });
  box.addEventListener('input', () => { sinc(box, range); disparar(); });
  box.addEventListener('change', () => { sinc(box, range); disparar(); });
  const lab = el('label', { class: 'campo campo-desliza' + (dica ? ' com-dica' : '') },
    el('span', { class: 'rotulo', text: rotulo }),
    el('span', { class: 'desliza-linha' }, range, el('span', { class: 'entrada mini' }, box, un2)));
  if (dica) lab.dataset.dica = dica;
  pai.append(lab);
  const f = () => { const v = parseFloat(String(box.value).replace(',', '.')); return Number.isFinite(v) ? v : valor; };
  f.input = box;
  f.definir = v => { box.value = v; range.value = v; disparar(); };
  return f;
}

export function escolha(pai, rotulo, opcoes, valor, { dica } = {}) {
  const s = el('select');
  for (const [v, t] of opcoes) s.append(el('option', { value: v, text: t }));
  s.value = valor;
  linha(pai, rotulo, dica, s);
  const f = () => s.value;
  f.input = s;
  f.definir = v => { s.value = v; avisar(s); };
  return f;
}

export function marcar(pai, rotulo, valor, { dica } = {}) {
  const c = el('input', { type: 'checkbox' });
  c.checked = valor;
  const lab = el('label', { class: 'campo campo-check' }, c, el('span', { class: 'rotulo', text: rotulo }));
  if (dica) { lab.dataset.dica = dica; lab.classList.add('com-dica'); }
  pai.append(lab);
  const f = () => c.checked;
  f.input = c;
  f.definir = v => { c.checked = !!v; avisar(c); };
  return f;
}

export function cor(pai, rotulo, valor, { dica } = {}) {
  const c = el('input', { type: 'color', value: valor });
  linha(pai, rotulo, dica, c);
  const f = () => c.value;
  f.input = c;
  f.definir = v => { c.value = v; avisar(c); };
  return f;
}

// aoRemover: liga a miniatura + botão "Remover" (aparecem depois de escolher o arquivo)
// galeria: campos que aceitam .svg ganham o botão "Galeria" (artes prontas), que entrega o desenho como se fosse um arquivo
export function arquivo(pai, rotulo, accept, aoEscolher, { dica, multiplo = false, aoRemover = null, miniatura = true, galeria = /svg/i.test(accept) && !multiplo } = {}) {
  const inp = el('input', { type: 'file', accept, multiple: multiplo });
  linha(pai, rotulo, dica, inp, true);
  if (galeria) {
    const bg = el('button', { class: 'btn-mini btn-galeria', type: 'button', text: '🖼 Galeria de artes' });
    bg.addEventListener('click', async () => {
      const { abrirGaleria } = await import('./galeria.js');
      const it = await abrirGaleria();
      if (!it) return;
      const f = new File([it.svg], `${it.nome}.svg`, { type: 'image/svg+xml' });
      await aoEscolher(f);
      mostrarEscolhido(f);
    });
    pai.append(bg);
  }
  let mini = null, btn = null;
  if (aoRemover) {
    if (miniatura) { mini = el('img', { class: 'miniatura', alt: rotulo }); mini.hidden = true; pai.append(mini); }
    btn = el('button', { class: 'btn-mini', type: 'button', text: 'Remover', title: `Remover: ${rotulo}` }); btn.hidden = true;
    btn.addEventListener('click', () => {
      try { inp.value = ''; } catch {}
      if (mini) { mini.hidden = true; mini.removeAttribute('src'); }
      btn.hidden = true;
      aoRemover();
    });
    pai.append(btn);
  }
  function mostrarEscolhido(f) {
    if (mini && (/^image\//.test(f.type || '') || /\.svg$/i.test(f.name))) { mini.src = URL.createObjectURL(f); mini.hidden = false; }
    if (btn) btn.hidden = false;
  }
  inp.addEventListener('change', async () => {
    if (!inp.files.length) return;
    const f = inp.files[0];
    await aoEscolher(multiplo ? [...inp.files] : f);
    mostrarEscolhido(f);
  });
  return inp;
}

export function botao(pai, texto, acao, { primario = false } = {}) {
  const b = el('button', { class: primario ? 'btn primario' : 'btn', text: texto, onclick: acao, type: 'button' });
  pai.append(b);
  return b;
}

export function acoes(pai) { const d = el('div', { class: 'acoes' }); pai.append(d); return d; }
export function texto(pai, t, cls = 'nota') { const p = el('p', { class: cls, text: t }); pai.append(p); return p; }
export function saida(pai) { const d = el('div', { class: 'saida' }); pai.append(d); return d; }
export function secao(pai, titulo) {
  const s = el('fieldset', { class: 'secao' }, el('legend', { text: titulo }));
  pai.append(s);
  return s;
}
export function tabela(linhas) {
  return '<table>' + linhas.map(([k, v, cls]) => `<tr><td>${k}</td><td class="${cls || ''}">${v}</td></tr>`).join('') + '</table>';
}
export const mm = (v, c = 1) => `${Number(v).toFixed(c).replace('.', ',')} mm`;
export const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// escuta mudança em vários campos de uma vez
export function aoMudar(campos, fn) {
  for (const c of campos) {
    const alvo = c.input || c;
    alvo.addEventListener('input', fn);
    alvo.addEventListener('change', fn);
  }
}

export function subAbas(pai, nomes, aoTrocar) {
  const barra = el('div', { class: 'sub-abas', role: 'tablist' });
  const paineis = nomes.map(() => el('div', { class: 'sub-painel' }));
  const botoes = nomes.map((n, i) => el('button', { type: 'button', class: 'sub-aba', text: n, onclick: () => ativar(i) }));
  botoes.forEach(b => barra.append(b));
  pai.append(barra, ...paineis);
  function ativar(i) {
    paineis.forEach((p, j) => (p.hidden = j !== i));
    botoes.forEach((b, j) => b.classList.toggle('ativa', j === i));
    aoTrocar?.(i);
  }
  ativar(0);
  return { paineis, ativar };
}

// presets salvos no navegador (não guardam a posição clicada)
export function presets(pai, chave, campos, depoisDeCarregar) {
  const k = `k3d:presets:${chave}`;
  const ler = () => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const gravar = d => { try { localStorage.setItem(k, JSON.stringify(d)); } catch { /* sem espaço */ } };
  const s = el('select');
  const atualizar = () => {
    s.replaceChildren(el('option', { value: '', text: 'Presets salvos…' }));
    for (const n of Object.keys(ler()).sort()) s.append(el('option', { value: n, text: n }));
  };
  const b = el('div', { class: 'presets' }, s);
  const btn = (t, fn) => b.append(el('button', { type: 'button', class: 'btn pequeno', text: t, onclick: fn }));
  btn('Salvar', () => {
    const nome = prompt('Nome do preset:', s.value || '');
    if (!nome) return;
    const d = ler();
    d[nome] = Object.fromEntries(Object.entries(campos).map(([c, f]) => [c, f()]));
    gravar(d);
    atualizar();
    s.value = nome;
  });
  btn('Carregar', () => {
    const p = ler()[s.value];
    if (!p) return;
    for (const [c, v] of Object.entries(p)) campos[c]?.definir?.(v);
    depoisDeCarregar?.();
  });
  btn('Excluir', () => {
    if (!s.value) return;
    const d = ler();
    delete d[s.value];
    gravar(d);
    atualizar();
  });
  atualizar();
  pai.append(b);
}
