// Modelos do lote 3: porta-saquinho, placa Aberto/Fechado giratória, divisor de gaveta, skyline e ponteira de caneta.
import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoPortaSaquinho, geoPlacaGiratoria, geoDivisor, geoSkyline, geoPonteira, retArred, skylineGerado } from './geo.js';
import { deslizante, numero, arquivo, escolha, marcar, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const pol = cs => (cs ? cs.toPolygons() : []);
const txt = async (fonte, v) => { v = (v || '').trim(); return v ? textoParaSecao(await obterFonte(fonte), v, { altura: 10 }) : null; };
const centro = ctx => [ctx.mesa.x / 2, ctx.mesa.y / 2];
const sliders = (aba, raiz, mudou, lista) => {
  let sec = null;
  for (const it of lista) {
    if (typeof it === 'string') { sec = secao(raiz, it); continue; }
    const [k, rot, v, o = {}] = it;
    aba[k] = deslizante(sec, rot, v, { aoMudar: mudou, un: 'mm', ...o });
  }
};
const valores = (aba, chaves) => Object.fromEntries(chaves.map(k => [k, aba[k]()]));

// ---------- Porta-saquinho ----------
const K_SAQ = ['diametro', 'parede', 'altura', 'furoSaida', 'folga', 'alca'];
export const portaSaquinho = criarEditorModelo({
  id: 'porta-saquinho', nome: 'Porta-saquinho de Pet (com nome)',
  descricao: 'Dispenser de sacolinha pra prender na guia: tubo com saída embaixo e tampa de encaixe com alça e o nome do pet embutido. Medida padrão pros rolinhos comuns.',
  partes: [{ id: 'corpo', nome: 'Tubo', cor: 0x2b6cb0 }, { id: 'tampa', nome: 'Tampa', cor: 0x2b6cb0 }, { id: 'texto', nome: 'Nome', cor: 0xffffff }],
  montarConteudo(s, ctx, mudou) {
    this.nomeTxt = campoTexto(s, 'Nome do pet', 'THOR');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    aoMudar([this.nomeTxt], mudou);
    texto(s, 'Tubo em pé e tampa com o nome pra baixo (já sai assim no arquivo). Meça o rolinho: diâmetro interno = rolo + 2 mm.');
  },
  montarParametros(raiz, ctx, mudou) {
    sliders(this, raiz, mudou, ['Medidas', ['diametro', 'Diâmetro externo', 38, { min: 25, max: 60, passo: 0.5 }], ['altura', 'Altura do tubo', 70, { min: 30, max: 120, passo: 1 }],
      ['parede', 'Parede', 2.2, { min: 1.2, max: 4, passo: 0.1 }], ['furoSaida', 'Furo de saída (embaixo)', 14, { min: 6, max: 25, passo: 0.5 }],
      ['folga', 'Folga da tampa', 0.3, { min: 0.1, max: 0.8, passo: 0.05 }], ['alca', 'Furo da alça', 9, { min: 4, max: 20, passo: 0.5, dica: 'Pro mosquetão da guia.' }]]);
  },
  async gerar(ctx) {
    const p = valores(this, K_SAQ), r = geoPortaSaquinho({ texto: await txt(this.fonte(), this.nomeTxt()) }, p), c = centro(ctx);
    return { partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [...c, 0]]), imprimir: r.imprimir,
      resumo: `Porta-saquinho Ø ${p.diametro} × ${p.altura} mm (interno Ø ${(p.diametro - 2 * p.parede).toFixed(1)} mm).` };
  },
  async compor2D() {
    const p = valores(this, K_SAQ), C = M().CrossSection;
    return { largura: p.diametro * 2 + 40, altura: p.diametro + 30, partes: [{ id: 'corpo', poligonos: pol(C.circle(p.diametro / 2, 64).subtract(C.circle(p.furoSaida / 2, 48))) }], dica: 'Vista de baixo do tubo (furo de saída). Veja o conjunto em 3D.' };
  },
});

// ---------- Placa Aberto/Fechado giratória ----------
const K_GIR = ['largura', 'altura', 'espessura', 'moldura', 'folga', 'pino', 'folgaPino', 'raio', 'alturaTexto', 'relevo', 'profVerso'];
export const placaGiratoria = criarEditorModelo({
  id: 'placa-giratoria', nome: 'Placa Aberto/Fechado Giratória',
  descricao: 'Placa de porta com painel que gira dentro da moldura (pinos impressos no lugar): ABERTO de um lado, FECHADO do outro. Sai da mesa montada.',
  partes: [{ id: 'moldura', nome: 'Moldura', cor: 0x1f2328 }, { id: 'painel', nome: 'Painel', cor: 0xf2f2f2 }, { id: 'frente', nome: 'Texto da frente', cor: 0x1f9d55 }, { id: 'verso', nome: 'Texto do verso', cor: 0xd64545 }],
  montarConteudo(s, ctx, mudou) {
    this.frente = campoTexto(s, 'Frente', 'ABERTO'); this.verso = campoTexto(s, 'Verso', 'FECHADO');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    aoMudar([this.frente, this.verso], mudou);
    texto(s, 'Imprima deitada, sem suporte. Depois gire o painel com cuidado pra soltar os pinos. O verso fica embutido no fundo (aparece certo quando o painel gira).');
  },
  montarParametros(raiz, ctx, mudou) {
    sliders(this, raiz, mudou, ['Placa', ['largura', 'Largura', 160, { min: 80, max: 250, passo: 1 }], ['altura', 'Altura', 70, { min: 40, max: 160, passo: 1 }],
      ['espessura', 'Espessura', 6, { min: 4.5, max: 10, passo: 0.5, dica: 'O pino fica no meio da espessura.' }], ['moldura', 'Largura da moldura', 8, { min: 5, max: 20, passo: 0.5 }],
      ['raio', 'Cantos', 8, { min: 0, max: 30, passo: 0.5 }],
      'Giro (impresso no lugar)', ['folga', 'Folga painel ↔ moldura', 0.6, { min: 0.3, max: 1.5, passo: 0.05 }], ['pino', 'Diâmetro do pino', 3.2, { min: 2, max: 5, passo: 0.1 }],
      ['folgaPino', 'Folga do pino', 0.4, { min: 0.2, max: 0.8, passo: 0.05 }],
      'Textos', ['alturaTexto', 'Altura do texto', 24, { min: 8, max: 80, passo: 0.5 }], ['relevo', 'Relevo (frente)', 1, { min: 0.4, max: 2.5, passo: 0.1 }], ['profVerso', 'Profundidade do verso', 0.6, { min: 0.2, max: 1.2, passo: 0.2 }]]);
  },
  async formas() { return { frente: await txt(this.fonte(), this.frente()), verso: await txt(this.fonte(), this.verso()) }; },
  async compor2D() {
    const p = valores(this, K_GIR), C = M().CrossSection, f = await this.formas();
    const ext = retArred(p.largura, p.altura, p.raio), vao = retArred(p.largura - 2 * p.moldura, p.altura - 2 * p.moldura, Math.max(p.raio - p.moldura, 1));
    const partes = [{ id: 'moldura', poligonos: pol(ext.subtract(vao)) }, { id: 'painel', poligonos: pol(vao.offset(-p.folga)) }];
    if (f.frente) { const b = f.frente.bounds(), k = Math.min((p.largura - 2 * p.moldura - 8) / (b.max[0] - b.min[0]), p.alturaTexto / (b.max[1] - b.min[1])); const t = f.frente.scale([k, k]), tb = t.bounds(); partes.push({ id: 'frente', poligonos: pol(t.translate([-(tb.min[0] + tb.max[0]) / 2, -(tb.min[1] + tb.max[1]) / 2])) }); }
    return { largura: p.largura + 20, altura: p.altura + 20, partes, dica: 'Frente. O verso (embutido) aparece em 3D, por baixo.' };
  },
  async gerar(ctx) {
    const p = valores(this, K_GIR), r = geoPlacaGiratoria(await this.formas(), p), c = centro(ctx);
    return { partes: r.partes, montado: r.partes.map(([id, m]) => [id, m, [...c, 0]]),
      resumo: `Placa ${p.largura} × ${p.altura} × ${p.espessura} mm com painel giratório (pinos Ø ${p.pino} mm, folga ${p.folgaPino} mm). Sai montada da mesa.` };
  },
});

// ---------- Divisor de gaveta ----------
const K_DIV = ['comprimento', 'altura', 'espessura', 'raio', 'pegador', 'encaixe', 'alturaTexto', 'relevo', 'textoY'];
export const divisorGaveta = criarEditorModelo({
  id: 'divisor-gaveta', nome: 'Divisor de Gaveta com Nome',
  descricao: 'Plaquinha divisória de gaveta/caixa com o nome em relevo (talheres, meias, ferramentas...). Encaixes nas pontas pra trilhos e pega-mão em cima.',
  partes: [{ id: 'divisor', nome: 'Divisor', cor: 0xf2f2f2 }, { id: 'texto', nome: 'Nome', cor: 0x1f2328 }],
  montarConteudo(s, ctx, mudou) {
    this.nomeTxt = campoTexto(s, 'Texto', 'TALHERES'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Bold.ttf', { aoMudar: mudou });
    aoMudar([this.nomeTxt], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    sliders(this, raiz, mudou, ['Medidas', ['comprimento', 'Comprimento', 180, { min: 40, max: 250, passo: 1, dica: 'Largura interna da gaveta − 1 mm.' }], ['altura', 'Altura', 50, { min: 15, max: 150, passo: 1 }],
      ['espessura', 'Espessura', 2.4, { min: 1.2, max: 6, passo: 0.2 }], ['raio', 'Cantos', 4, { min: 0, max: 20, passo: 0.5 }],
      ['pegador', 'Pega-mão (0 = sem)', 24, { min: 0, max: 60, passo: 1 }], ['encaixe', 'Encaixe nas pontas (0 = sem)', 1.4, { min: 0, max: 6, passo: 0.1, dica: 'Rebaixo nas pontas de baixo pra trilho/ranhura.' }],
      'Texto', ['alturaTexto', 'Altura do texto', 12, { min: 4, max: 60, passo: 0.5 }], ['relevo', 'Relevo', 0.8, { min: 0.4, max: 3, passo: 0.1 }], ['textoY', 'Ajuste vertical', 4, { min: -40, max: 40, passo: 0.5 }]]);
  },
  async gerar(ctx) {
    const p = { ...valores(this, K_DIV), encaixeAltura: 0.4 }, r = geoDivisor({ texto: await txt(this.fonte(), this.nomeTxt()) }, p), c = centro(ctx);
    return { partes: r.partes, montado: r.partes.map(([id, m]) => [id, m, [...c, 0]]), resumo: `Divisor ${p.comprimento} × ${p.altura} × ${p.espessura} mm. Imprime deitado.` };
  },
  async compor2D() {
    const p = valores(this, K_DIV);
    return { largura: p.comprimento + 20, altura: p.altura + 20, partes: [{ id: 'divisor', poligonos: pol(retArred(p.comprimento, p.altura, Math.min(p.raio, p.altura / 2 - 0.1))) }], dica: 'Veja o texto e os encaixes em 3D.' };
  },
});

// ---------- Skyline ----------
const K_SKY = ['largura', 'espessura', 'alturaPredios', 'semente', 'densidade', 'alturaFaixa', 'margem', 'passoJanela', 'relevo', 'folgaBase', 'profBase', 'altBase'];
export const skyline = criarEditorModelo({
  id: 'skyline', nome: 'Skyline com Nome da Cidade',
  descricao: 'Quadro de silhueta de cidade em pé numa base, com o nome embaixo. Prédios gerados (troque o "sorteio" até gostar) ou envie o SVG do skyline da sua cidade. Janelinhas vazadas pra LED atrás.',
  partes: [{ id: 'skyline', nome: 'Silhueta', cor: 0x1f2328 }, { id: 'texto', nome: 'Nome da cidade', cor: 0xe2bf5f }, { id: 'base', nome: 'Base', cor: 0x1f2328 }],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.cidade = campoTexto(s, 'Nome da cidade', 'BRASÍLIA'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    arquivo(s, 'Skyline da sua cidade (SVG, opcional)', '.svg', async f => { this.arte = await f.text(); mudou(); }, { aoRemover: () => { this.arte = null; mudou(); }, galeria: false, dica: 'Sem arquivo, os prédios são gerados.' });
    this.janelas = marcar(s, 'Janelinhas vazadas', true);
    aoMudar([this.cidade], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    sliders(this, raiz, mudou, ['Quadro', ['largura', 'Largura', 160, { min: 60, max: 240, passo: 1 }], ['alturaPredios', 'Altura dos prédios', 60, { min: 20, max: 150, passo: 1 }],
      ['espessura', 'Espessura', 4, { min: 2, max: 8, passo: 0.2 }], ['alturaFaixa', 'Faixa do nome', 14, { min: 8, max: 40, passo: 0.5 }], ['margem', 'Margem da faixa', 4, { min: 0, max: 20, passo: 0.5 }],
      ['relevo', 'Relevo do nome', 1, { min: 0.4, max: 3, passo: 0.1 }],
      'Prédios gerados', ['semente', 'Sorteio (troque até gostar)', 7, { min: 1, max: 999, passo: 1, un: '' }], ['densidade', 'Prédios mais finos', 0.6, { min: 0, max: 1, passo: 0.05, un: '' }],
      ['passoJanela', 'Tamanho das janelas', 4, { min: 2.5, max: 10, passo: 0.5 }],
      'Base', ['altBase', 'Altura da base', 14, { min: 8, max: 30, passo: 0.5 }], ['profBase', 'Profundidade da base', 26, { min: 14, max: 60, passo: 1 }], ['folgaBase', 'Folga do encaixe', 0.3, { min: 0.1, max: 0.8, passo: 0.05 }]]);
  },
  async formas() { return { texto: await txt(this.fonte(), this.cidade()), arte: this.arte ? svgParaSecao(this.arte, { largura: 60, ignorarBranco: true }) : null }; },
  params() { const p = valores(this, K_SKY); p.janelas = !!this.janelas(); p.semente = Math.round(p.semente); return p; },
  async compor2D() {
    const p = this.params(), f = await this.formas();
    const pr = f.arte ? f.arte : skylineGerado(p.largura, p.alturaPredios, p.semente, p.densidade), b = pr.bounds();
    return { largura: p.largura + 30, altura: (p.alturaPredios + p.alturaFaixa) * 2 + 30, partes: [{ id: 'skyline', poligonos: pol(pr.translate([-(b.min[0] + b.max[0]) / 2, -b.min[1]])) }], dica: 'Prévia da silhueta. Troque o "Sorteio" pra outro desenho de prédios.' };
  },
  async gerar(ctx) {
    const p = this.params(), r = geoSkyline(await this.formas(), p), c = centro(ctx);
    return { partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [...c, 0]]), imprimir: r.imprimir,
      resumo: `Skyline ${p.largura} mm de largura e ${r.altura.toFixed(0)} mm de altura, em pé na base. Arquivos saem deitados.` };
  },
});

// ---------- Ponteira de caneta (lote) ----------
const K_PON = ['tamanho', 'borda', 'espessura', 'diamCaneta', 'parede', 'encaixe', 'folga', 'relevo', 'quantidade', 'mesa', 'espacoLote'];
export const ponteiraCaneta = criarEditorModelo({
  id: 'ponteira-caneta', exemplo: ['arte'], nome: 'Ponteira de Caneta com Logo (lote)',
  descricao: 'Ponteira que encaixa no fim da caneta, no formato do logo da empresa. Gera várias de uma vez, arrumadas na mesa — ótimo pra brinde.',
  partes: [{ id: 'corpo', nome: 'Ponteira', cor: 0x1f2328 }, { id: 'arte', nome: 'Logo', cor: 0xe2bf5f }],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    arquivo(s, 'Logo (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) }; mudou();
    }, { aoRemover: () => { this.arte = null; mudou(); } });
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    texto(s, 'BIC cristal: Ø 8 mm na ponta de trás. Meça a sua caneta com paquímetro e ajuste o diâmetro.');
  },
  montarParametros(raiz, ctx, mudou) {
    sliders(this, raiz, mudou, ['Ponteira', ['tamanho', 'Tamanho do logo', 22, { min: 10, max: 50, passo: 0.5 }], ['borda', 'Borda', 2, { min: 0.8, max: 5, passo: 0.1 }],
      ['espessura', 'Espessura', 3, { min: 2, max: 6, passo: 0.2 }], ['relevo', 'Relevo do logo', 0.8, { min: 0.4, max: 2, passo: 0.1 }],
      'Encaixe na caneta', ['diamCaneta', 'Diâmetro da caneta', 8, { min: 5, max: 14, passo: 0.1 }], ['folga', 'Folga', 0.2, { min: 0, max: 0.6, passo: 0.05, dica: 'Pra apertado use 0,1; folgado 0,3.' }],
      ['encaixe', 'Profundidade do encaixe', 16, { min: 8, max: 30, passo: 0.5 }], ['parede', 'Parede do tubo', 1.8, { min: 1, max: 3, passo: 0.1 }],
      'Lote', ['quantidade', 'Quantidade', 12, { min: 1, max: 100, passo: 1, un: 'un' }], ['mesa', 'Largura útil da mesa', 230, { min: 100, max: 400, passo: 5 }], ['espacoLote', 'Espaço entre peças', 4, { min: 1, max: 15, passo: 0.5 }]]);
  },
  async formas() {
    const a = this.arte;
    if (!a) throw new Error('Envie o logo (SVG ou PNG) ou escolha um na Galeria.');
    return { arte: a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 30, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar: this.limiar(), largura: 30 }) };
  },
  async compor2D() {
    const f = await this.formas(), b = f.arte.bounds();
    return { largura: 60, altura: 70, partes: [{ id: 'arte', poligonos: pol(f.arte.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2])) }], dica: 'Veja a ponteira e o lote em 3D.' };
  },
  async gerar(ctx) {
    const p = valores(this, K_PON), r = geoPonteira(await this.formas(), p), c = centro(ctx);
    return { partes: r.partes, montado: r.partes.map(([id, m]) => [id, m, [...c, 0]]),
      resumo: `${r.cabem} ponteira(s) na mesa (cada uma ${r.unidade[0].toFixed(0)} × ${r.unidade[1].toFixed(0)} mm), encaixe Ø ${(p.diamCaneta + 2 * p.folga).toFixed(1)} mm.`
        + (r.cabem < r.pedidas ? ` ⚠ Pediu ${r.pedidas}: só couberam ${r.cabem}, gere em mais de uma vez.` : '') };
  },
});
