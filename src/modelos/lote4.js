// Modelos do lote 4 (inspirados no MakerLab).
import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { deslizante, numero, arquivo, escolha, marcar, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';
import * as G from './geo4.js';
import ESTRELAS from '../core/estrelas.json';

const pol = cs => (cs ? cs.toPolygons() : []);
const txt = async (fonte, v) => { v = (v || '').trim(); return v ? textoParaSecao(await obterFonte(fonte), v, { altura: 10 }) : null; };
const centro = ctx => [ctx.mesa.x / 2, ctx.mesa.y / 2, 0];
const vals = (aba, ks) => Object.fromEntries(ks.map(k => [k, aba[k]()]));
// lista: 'Título da seção' | [chave, rótulo, valor, opções]
function sliders(aba, raiz, mudou, lista) {
  let sec = null;
  for (const it of lista) {
    if (typeof it === 'string') { sec = secao(raiz, it); continue; }
    const [k, rot, v, o = {}] = it;
    aba[k] = deslizante(sec, rot, v, { aoMudar: mudou, un: 'mm', ...o });
  }
  return lista.filter(x => typeof x !== 'string').map(x => x[0]);
}
// campo de foto (com foto de exemplo quando vazio)
function campoFoto(aba, s, mudou, rotulo = 'Foto (JPG ou PNG)') {
  aba.foto = null;
  arquivo(s, rotulo, '.png,.jpg,.jpeg,.webp', async f => { aba.foto = await lerImagem(f, 900); mudou(); },
    { galeria: false, aoRemover: () => { aba.foto = null; mudou(); } });
}
const fotoOuExemplo = aba => aba.foto || (aba._fotoEx ||= G.fotoExemplo());
const avisoFoto = aba => (aba.foto ? '' : '<br>Usando a foto de exemplo: envie a sua no campo "Foto".');
// campo de arte (SVG/PNG) com galeria; usa a raposa de exemplo no começo (cfg.exemplo)
function campoArte(aba, s, mudou, rotulo = 'Arte (SVG ou PNG)', prop = 'arte') {
  aba[prop] = null;
  arquivo(s, rotulo, '.svg,.png,.jpg,.jpeg,.webp', async f => {
    aba[prop] = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
    mudou();
  }, { aoRemover: () => { aba[prop] = null; mudou(); } });
}
const arteCs = (aba, prop = 'arte', limiar = 128) => {
  const a = aba[prop]; if (!a) return null;
  return a.tipo === 'svg' ? svgParaSecao(a.dado, { largura: 30, ignorarBranco: true }) : imagemParaSecao(a.dado, { limiar, largura: 30 });
};
// prévia 2D genérica: projeta (vista de cima) as peças "pra imprimir"
async function previaProjecao(aba, cfg, ctx, dica) {
  const r = await cfg.gerar.call(aba, ctx);
  const lista = r.imprimir || r.partes, partes = [];
  let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
  for (const [id, m] of lista) { const cs = m.project(); const b = cs.bounds(); mn = [Math.min(mn[0], b.min[0]), Math.min(mn[1], b.min[1])]; mx = [Math.max(mx[0], b.max[0]), Math.max(mx[1], b.max[1])]; partes.push([id, cs]); }
  new Set([...(r.partes || []), ...(r.montado || []), ...(r.imprimir || [])].map(x => x[1])).forEach(m => m.delete?.());
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
  return { largura: mx[0] - mn[0] + 20, altura: mx[1] - mn[1] + 20, partes: partes.map(([id, cs]) => ({ id, poligonos: pol(cs.translate([-cx, -cy])) })), dica: dica || 'Vista de cima (como sai na mesa). Veja em 3D pra conferir.' };
}
function modelo(cfg) {
  if (!cfg.compor2D) cfg.compor2D = async function (ctx) { return previaProjecao(this, cfg, ctx, cfg.dica2D); };
  return criarEditorModelo(cfg);
}
const resultado = (ctx, montado, imprimir, resumo, extra = {}) => ({
  partes: montado, montado: montado.map(([id, m]) => [id, m, centro(ctx)]), imprimir, resumo, ...extra,
});

// ================= 1. Lightbox em camadas =================
const K_LB = [];
export const lightbox = modelo({
  id: 'lightbox', nome: 'Lightbox em Camadas (caixa de luz)',
  descricao: 'Quadro de camadas recortadas a partir de uma foto ou arte (do fundo pra frente), com caixa pra fita de LED atrás. Com a luz acesa, a cena ganha profundidade.',
  partes: [{ id: 'fundo', nome: 'Caixa do LED (fundo)', cor: 0x1f2328 }, ...[0xf4f1ea, 0xd9d2c5, 0xb3a996, 0x857b69, 0x4f483d, 0x2b2620].map((c, i) => ({ id: `camada${i + 1}`, nome: `Camada ${i + 1}${i ? '' : ' (de trás)'}`, cor: c }))],
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou, 'Foto ou desenho (JPG/PNG)');
    this.inverter = marcar(s, 'Inverter (claro vira camada)', false);
    this.inverter.input.addEventListener('change', mudou);
    texto(s, 'Imprima o fundo em preto, a camada 1 (de trás) em branco e as outras em tons cada vez mais escuros (ou todas em branco). Cole uma fita de LED dentro do fundo.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_LB.splice(0, K_LB.length, ...sliders(this, raiz, mudou, ['Quadro', ['largura', 'Largura', 150, { min: 60, max: 230, passo: 1 }], ['altura', 'Altura', 110, { min: 50, max: 230, passo: 1 }],
      ['moldura', 'Moldura', 6, { min: 3, max: 20, passo: 0.5 }], ['raio', 'Cantos', 4, { min: 0, max: 20, passo: 0.5 }],
      'Camadas', ['camadas', 'Quantidade de camadas', 5, { min: 2, max: 6, passo: 1, un: '' }], ['limiarTras', 'Tom da camada de trás', 220, { min: 60, max: 254, passo: 1, un: '' }],
      ['limiarFrente', 'Tom da camada da frente', 70, { min: 5, max: 250, passo: 1, un: '' }], ['zoom', 'Zoom da imagem', 1, { min: 0.5, max: 2, passo: 0.05, un: '×' }],
      ['ajusteX', 'Mover imagem (horizontal)', 0, { min: -60, max: 60, passo: 0.5 }], ['ajusteY', 'Mover imagem (vertical)', 0, { min: -60, max: 60, passo: 0.5 }],
      ['limpar', 'Limpar detalhes pequenos', 0.4, { min: 0, max: 2, passo: 0.1 }],
      'Espessuras', ['espCamada', 'Espessura de cada camada', 1.2, { min: 0.6, max: 3, passo: 0.1 }], ['espaco', 'Espaço entre camadas', 4, { min: 1, max: 12, passo: 0.5 }],
      ['difusor', 'Difusor do fundo', 0.8, { min: 0.4, max: 2, passo: 0.1 }], ['fundoProf', 'Profundidade da caixa do LED', 22, { min: 10, max: 40, passo: 1 }], ['furoCabo', 'Rasgo do cabo', 8, { min: 4, max: 16, passo: 0.5 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_LB), inverter: !!this.inverter(), mesa: Math.min(ctx.mesa.x, ctx.mesa.y) - 20 };
    const r = G.geoLightbox(fotoOuExemplo(this), p);
    return resultado(ctx, r.montado, r.imprimir, `Lightbox ${p.largura} × ${p.altura} mm, ${p.camadas} camadas, ${r.profundidade.toFixed(0)} mm de profundidade montado.` + avisoFoto(this));
  },
});

// ================= 2. Mapa das estrelas =================
const CIDADES = { 'Brasília': [-15.79, -47.88], 'São Paulo': [-23.55, -46.63], 'Rio de Janeiro': [-22.91, -43.17], 'Belo Horizonte': [-19.92, -43.94], 'Salvador': [-12.97, -38.5],
  'Fortaleza': [-3.73, -38.52], 'Recife': [-8.05, -34.9], 'Curitiba': [-25.43, -49.27], 'Porto Alegre': [-30.03, -51.23], 'Manaus': [-3.12, -60.02], 'Belém': [-1.46, -48.49], 'Goiânia': [-16.69, -49.26],
  'Florianópolis': [-27.59, -48.55], 'Natal': [-5.79, -35.21], 'Campo Grande': [-20.47, -54.62], 'Cuiabá': [-15.6, -56.1] };
const K_ME = [];
export const mapaEstrelas = modelo({
  id: 'mapa-estrelas', nome: 'Mapa das Estrelas (data especial)',
  descricao: 'O céu exatamente como estava numa data, hora e cidade (nascimento, casamento, primeiro encontro), com constelações e o texto embaixo. Calculado com o catálogo de estrelas reais.',
  partes: [{ id: 'placa', nome: 'Placa', cor: 0x1f2a44 }, { id: 'estrelas', nome: 'Estrelas', cor: 0xf4f1ea }, { id: 'anel', nome: 'Anel', cor: 0xe2bf5f }, { id: 'texto', nome: 'Texto', cor: 0xe2bf5f }],
  montarConteudo(s, ctx, mudou) {
    this.cidade = escolha(s, 'Cidade', [...Object.keys(CIDADES).map(c => [c, c]), ['outra', 'Outra (digitar coordenadas)']], 'Brasília');
    this.lat = campoTexto(s, 'Latitude', '-15.79', { dica: 'Só pra "Outra": negativo = sul (pegue no Google Maps).' });
    this.lon = campoTexto(s, 'Longitude', '-47.88', { dica: 'Negativo = oeste.' });
    this.data = campoTexto(s, 'Data', '2020-05-10'); this.data.input.type = 'date';
    this.hora = campoTexto(s, 'Hora', '20:30'); this.hora.input.type = 'time';
    this.fuso = escolha(s, 'Fuso', [['-2', 'UTC−2 (Noronha)'], ['-3', 'UTC−3 (Brasília)'], ['-4', 'UTC−4 (Manaus/Cuiabá)'], ['-5', 'UTC−5 (Acre)']], '-3');
    this.titulo = campoTexto(s, 'Título', 'Ana & João');
    this.info = campoTexto(s, 'Linha de baixo', 'Brasília · 10 de maio de 2020 · 20h30', { dica: 'Vazio = sem texto.' });
    this.fonte = seletorFonte(s, 'Fonte do título', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    this.formato = escolha(s, 'Formato', [['quadro', 'Quadro (céu + texto)'], ['disco', 'Só o disco do céu']], 'quadro');
    this.constelacoes = marcar(s, 'Linhas das constelações', true);
    this.constelacoes.input.addEventListener('change', mudou);
    aoMudar([this.cidade, this.lat, this.lon, this.data, this.hora, this.fuso, this.titulo, this.info, this.formato], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_ME.splice(0, K_ME.length, ...sliders(this, raiz, mudou, ['Céu', ['diametro', 'Diâmetro do céu', 150, { min: 60, max: 220, passo: 1 }], ['magMax', 'Quantas estrelas (magnitude)', 4.8, { min: 2.5, max: 5, passo: 0.1, un: '' , dica: 'Maior = mais estrelas fracas.' }],
      ['estrelaMin', 'Estrela menor', 0.45, { min: 0.3, max: 1.2, passo: 0.05 }], ['estrelaMax', 'Estrela maior', 1.6, { min: 0.8, max: 3, passo: 0.05 }], ['linha', 'Espessura das linhas', 0.45, { min: 0.3, max: 1, passo: 0.05 }],
      ['anelLargura', 'Anel em volta', 3, { min: 0, max: 8, passo: 0.5 }],
      'Placa', ['margem', 'Margem', 8, { min: 2, max: 25, passo: 0.5 }], ['raioPlaca', 'Cantos', 6, { min: 0, max: 30, passo: 0.5 }], ['espessura', 'Espessura', 2.4, { min: 1.6, max: 5, passo: 0.2 }],
      ['relevo', 'Relevo', 0.6, { min: 0.4, max: 1.6, passo: 0.1 }], ['alturaTitulo', 'Altura do título', 12, { min: 5, max: 30, passo: 0.5 }], ['alturaInfo', 'Altura da linha de baixo', 6, { min: 3, max: 15, passo: 0.5 }],
      ['espacoTexto', 'Espaço do texto', 6, { min: 2, max: 20, passo: 0.5 }]]));
  },
  ceu() {
    let lat, lon;
    if (this.cidade() === 'outra') { lat = parseFloat(String(this.lat()).replace(',', '.')); lon = parseFloat(String(this.lon()).replace(',', '.')); }
    else [lat, lon] = CIDADES[this.cidade()];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Latitude/longitude inválidas.');
    const [a, m, d] = String(this.data()).split('-').map(Number), [h, mi] = String(this.hora() || '0:0').split(':').map(Number);
    if (!a || !m || !d) throw new Error('Escolha a data.');
    const dataUTC = new Date(Date.UTC(a, m - 1, d, (h || 0) - Number(this.fuso()), mi || 0));
    return G.ceuEm(ESTRELAS, { lat, lon, dataUTC });
  },
  async layout() {
    const p = { ...vals(this, K_ME), constelacoes: !!this.constelacoes(), formato: this.formato() };
    const t1 = await txt(this.fonte(), this.titulo()), t2 = await txt('emb:Poppins-Bold.ttf', this.info());
    return { L: G.layoutMapaEstrelas(this.ceu(), [t1, t2], p), p };
  },
  async compor2D() {
    const { L } = await this.layout(), b = L.placa.bounds();
    const partes = [{ id: 'placa', poligonos: pol(L.placa) }, { id: 'estrelas', poligonos: pol(L.detalhe) }, { id: 'anel', poligonos: pol(L.anel) }, { id: 'texto', poligonos: pol(L.texto) }];
    return { largura: b.max[0] - b.min[0] + 20, altura: (b.max[1] - b.min[1]) * 2 + 20, partes, dica: 'Norte em cima, leste à esquerda (como olhando pro céu deitado).' };
  },
  async gerar(ctx) {
    const { L, p } = await this.layout(), pecas = G.geoMapaEstrelas(L, p);
    return resultado(ctx, pecas, null, `Mapa do céu Ø ${p.diametro} mm. Imprima a placa escura e troque o filamento (ou use o AMS) pras estrelas e o texto.`);
  },
});

// ================= 3. Cartão de música =================
const K_MU = [];
export const cartaoMusica = modelo({
  id: 'cartao-musica', nome: 'Cartão de Música (estilo player)',
  descricao: 'Plaquinha estilo tela de música: foto do casal/artista em 2 tons, nome da música, artista, barra de progresso e botões. Pode ficar em pé numa base.',
  partes: [{ id: 'cartao', nome: 'Cartão', cor: 0x111111 }, { id: 'detalhe', nome: 'Foto e textos', cor: 0xf4f1ea }, { id: 'base', nome: 'Base', cor: 0x111111 }],
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou);
    this.limiar = numero(s, 'Limiar da foto', 128, { passo: 1, min: 1, max: 254, dica: 'Ajusta o que vira branco/preto na foto.' });
    this.inverter = marcar(s, 'Inverter a foto', true);
    this.titulo = campoTexto(s, 'Música', 'Nossa Canção'); this.artista = campoTexto(s, 'Artista', 'Artista Favorito');
    this.t1 = campoTexto(s, 'Tempo atual', '1:24'); this.t2 = campoTexto(s, 'Duração', '3:45');
    this.base = marcar(s, 'Com base pra ficar em pé', true);
    for (const c of [this.inverter, this.base]) c.input.addEventListener('change', mudou);
    aoMudar([this.limiar, this.titulo, this.artista, this.t1, this.t2], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_MU.splice(0, K_MU.length, ...sliders(this, raiz, mudou, ['Cartão', ['largura', 'Largura', 85, { min: 50, max: 160, passo: 1 }], ['alturaFoto', 'Altura da foto (proporção)', 1, { min: 0.5, max: 1.4, passo: 0.05, un: '×' }],
      ['margem', 'Margem', 6, { min: 3, max: 15, passo: 0.5 }], ['raio', 'Cantos', 5, { min: 0, max: 15, passo: 0.5 }], ['espessura', 'Espessura', 2, { min: 1.2, max: 4, passo: 0.2 }], ['relevo', 'Relevo', 0.6, { min: 0.4, max: 1.5, passo: 0.1 }],
      'Textos e barra', ['alturaTitulo', 'Altura da música', 7, { min: 3, max: 15, passo: 0.5 }], ['alturaArtista', 'Altura do artista', 4.5, { min: 2.5, max: 10, passo: 0.5 }],
      ['progresso', 'Posição da barra', 0.4, { min: 0.05, max: 0.95, passo: 0.01, un: '' }], ['alturaBotoes', 'Tamanho dos botões', 8, { min: 4, max: 16, passo: 0.5 }], ['espaco', 'Espaçamento', 5, { min: 2, max: 10, passo: 0.5 }],
      'Base', ['altBase', 'Altura da base', 14, { min: 8, max: 30, passo: 0.5 }], ['profBase', 'Profundidade da base', 26, { min: 14, max: 50, passo: 1 }], ['folgaBase', 'Folga do encaixe', 0.3, { min: 0.1, max: 0.8, passo: 0.05 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_MU), limiar: this.limiar(), inverter: !!this.inverter(), base: !!this.base() };
    const T = { titulo: await txt('emb:Poppins-Bold.ttf', this.titulo()), artista: await txt('emb:Poppins-Regular.ttf', this.artista()) };
    const a = await txt('emb:Poppins-Bold.ttf', this.t1()), b = await txt('emb:Poppins-Bold.ttf', this.t2());
    if (a && b) T.tempos = [a, b];
    const L = G.layoutCartaoMusica(fotoOuExemplo(this), T, p), r = G.geoCartaoMusica(L, p);
    return resultado(ctx, r.montado, r.imprimir, `Cartão ${L.larg.toFixed(0)} × ${L.alt.toFixed(0)} mm.` + avisoFoto(this));
  },
});

// ================= 4. Porta-retrato Polaroid =================
const K_PO = [];
export const polaroid = modelo({
  id: 'polaroid', nome: 'Porta-retrato Polaroid (com ímã)',
  descricao: 'Moldura estilo foto instantânea com legenda embaixo e tampa de trás com bolso pra foto (Instax ou foto comum) e furos pra ímãs de geladeira. A foto entra por cima.',
  partes: [{ id: 'moldura', nome: 'Moldura', cor: 0xf4f1ea }, { id: 'legenda', nome: 'Legenda', cor: 0x2b2620 }, { id: 'tampa', nome: 'Tampa de trás', cor: 0xf4f1ea }],
  montarConteudo(s, ctx, mudou) {
    this.tamanho = escolha(s, 'Tamanho da foto', Object.entries(G.TAMANHOS_FOTO).map(([k, v]) => [k, v.nome]), 'instaxMini');
    this.legenda = campoTexto(s, 'Legenda', 'Férias 2026'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    aoMudar([this.tamanho, this.legenda], mudou);
    texto(s, 'Encaixe a moldura na tampa (pinos). Cole ímãs de 8 × 2 mm nos furos de trás pra ficar na geladeira.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_PO.splice(0, K_PO.length, ...sliders(this, raiz, mudou, ['Moldura', ['borda', 'Borda dos lados/cima', 6, { min: 3, max: 20, passo: 0.5 }], ['bordaBaixo', 'Borda de baixo', 18, { min: 6, max: 40, passo: 0.5 }],
      ['raio', 'Cantos', 2, { min: 0, max: 10, passo: 0.5 }], ['espFrente', 'Espessura da moldura', 3, { min: 2, max: 6, passo: 0.2 }], ['espTras', 'Espessura da tampa', 2.6, { min: 1.6, max: 5, passo: 0.2 }],
      ['espFoto', 'Espessura da foto', 0.6, { min: 0.2, max: 1.6, passo: 0.1, dica: 'Instax ~0,6 mm; foto comum ~0,3 mm.' }], ['folga', 'Folga dos pinos', 0.15, { min: 0.05, max: 0.5, passo: 0.05 }],
      ['alturaLegenda', 'Altura da legenda', 9, { min: 4, max: 20, passo: 0.5 }], ['relevo', 'Relevo da legenda', 0.6, { min: 0.4, max: 1.5, passo: 0.1 }],
      'Ímãs', ['imas', 'Quantidade de ímãs (0 ou 2)', 2, { min: 0, max: 2, passo: 2, un: '' }], ['diamIma', 'Diâmetro do ímã', 8, { min: 4, max: 15, passo: 0.5 }], ['espIma', 'Espessura do ímã', 2, { min: 1, max: 4, passo: 0.5 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_PO), tamanho: this.tamanho() };
    const r = G.geoPolaroid(await txt(this.fonte(), this.legenda()), p);
    return resultado(ctx, r.montado, r.imprimir, `Porta-retrato ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm (bolso da foto ${r.bolso[0]} × ${r.bolso[1]} mm, aberto em cima). Tampa de ${r.espTampa.toFixed(1)} mm (engrossa sozinha pro ímã não furar o bolso).`);
  },
});

// ================= 5. Moldura de encaixe =================
const K_MO = [];
export const molduraEncaixe = modelo({
  id: 'moldura-encaixe', nome: 'Moldura de Encaixe (sem cola)',
  descricao: 'Quadro em 4 barras que se encaixam com rabo-de-andorinha, do tamanho da sua foto, com rebaixo atrás pra foto e nome opcional na barra de baixo. Cada barra cabe na mesa.',
  partes: [{ id: 'cima', nome: 'Barra de cima', cor: 0x1f2328 }, { id: 'baixo', nome: 'Barra de baixo', cor: 0x1f2328 }, { id: 'esquerda', nome: 'Barra esquerda', cor: 0x1f2328 }, { id: 'direita', nome: 'Barra direita', cor: 0x1f2328 }, { id: 'moldura', nome: 'Barras (arquivo)', cor: 0x1f2328 }, { id: 'nome', nome: 'Nome', cor: 0xe2bf5f }],
  montarConteudo(s, ctx, mudou) {
    this.tam = escolha(s, 'Tamanho da foto', [['100x150', '10 × 15 cm'], ['130x180', '13 × 18 cm'], ['150x210', '15 × 21 cm'], ['89x127', '9 × 13 cm'], ['54x86', 'Instax Mini'], ['outro', 'Outro (ajuste abaixo)']], '100x150');
    this.tam.input.addEventListener('change', () => { const v = this.tam(); if (v !== 'outro') { const [w, h] = v.split('x').map(Number); this.larguraFoto.definir(w); this.alturaFoto.definir(h); } mudou(); });
    this.nomeTxt = campoTexto(s, 'Nome (barra de baixo, opcional)', 'FAMÍLIA'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Bold.ttf', { aoMudar: mudou });
    aoMudar([this.nomeTxt], mudou);
    texto(s, 'Encaixe as laterais nas barras de cima e de baixo empurrando de cima pra baixo. A foto vai por trás, no rebaixo.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_MO.splice(0, K_MO.length, ...sliders(this, raiz, mudou, ['Foto', ['larguraFoto', 'Largura da foto', 100, { min: 40, max: 300, passo: 1 }], ['alturaFoto', 'Altura da foto', 150, { min: 40, max: 300, passo: 1 }],
      'Moldura', ['largura', 'Largura da barra', 16, { min: 8, max: 40, passo: 0.5 }], ['espessura', 'Espessura', 8, { min: 4, max: 15, passo: 0.5 }], ['rebaixo', 'Profundidade do rebaixo (foto + vidro)', 2.4, { min: 0.6, max: 6, passo: 0.2 }],
      ['folga', 'Folga do encaixe', 0.2, { min: 0.05, max: 0.6, passo: 0.05 }], ['relevo', 'Relevo do nome', 0.8, { min: 0.4, max: 2, passo: 0.1 }]]));
  },
  async gerar(ctx) {
    const p = vals(this, K_MO), r = G.geoMolduraEncaixe(await txt(this.fonte(), this.nomeTxt()), p);
    return resultado(ctx, r.montado, r.imprimir, `Moldura ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm pra foto de ${p.larguraFoto} × ${p.alturaFoto} mm.`
      + (Math.max(r.W, r.H) > Math.min(ctx.mesa.x, ctx.mesa.y) ? ' ⚠ Uma barra é maior que a mesa: imprima na diagonal ou diminua.' : ''));
  },
});

// ================= 6. Bandeja bento =================
const K_BE = [];
export const bento = modelo({
  id: 'bandeja-bento', nome: 'Bandeja Bento (divisórias sob medida)',
  descricao: 'Organizador de gaveta/mesa: desenhe as divisórias com letras numa grade — a mesma letra junta as casas numa divisória só. Ex.: "AAB / CDB / CEE".',
  partes: [{ id: 'bandeja', nome: 'Bandeja', cor: 0x2b6cb0 }],
  dica2D: 'Vista de cima com as divisórias.',
  montarConteudo(s, ctx, mudou) {
    this.layout = campoTexto(s, 'Grade (linhas separadas por /)', 'AAB/CDB/CEE', { dica: 'Cada letra é uma casa; letras iguais vizinhas viram uma divisória maior. Ponto (.) = sem casa.' });
    aoMudar([this.layout], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_BE.splice(0, K_BE.length, ...sliders(this, raiz, mudou, ['Medidas', ['largura', 'Largura', 160, { min: 40, max: 250, passo: 1 }], ['profundidade', 'Profundidade', 120, { min: 40, max: 250, passo: 1 }],
      ['altura', 'Altura', 30, { min: 10, max: 100, passo: 1 }], ['parede', 'Parede', 2, { min: 1.2, max: 5, passo: 0.2 }], ['fundo', 'Fundo', 1.6, { min: 0.8, max: 4, passo: 0.2 }],
      ['raio', 'Cantos de fora', 6, { min: 0, max: 20, passo: 0.5 }], ['raioCelula', 'Cantos de dentro', 4, { min: 0.5, max: 15, passo: 0.5 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_BE), layout: this.layout() }, r = G.geoBento(p);
    return resultado(ctx, r.partes, null, `Bandeja ${p.largura} × ${p.profundidade} × ${p.altura} mm, grade ${r.grade[0]} × ${r.grade[1]}, ${r.celulas.length} divisória(s).`);
  },
});

// ================= 7. Caixa dobrável =================
const K_CX = [];
export const caixaDobravel = modelo({
  id: 'caixa-dobravel', nome: 'Caixa Dobrável (sai chapada)',
  descricao: 'Caixinha de presente que imprime chapada e dobra nos vincos, com abas nos cantos e tampa de encaixe. Nome/marca embutido na frente.',
  partes: [{ id: 'caixa', nome: 'Caixa', cor: 0xf4f1ea }, { id: 'marca', nome: 'Marca', cor: 0xd64545 }, { id: 'tampa', nome: 'Tampa', cor: 0xd64545 }],
  dica2D: 'A caixa aberta (como sai da mesa) e a tampa.',
  montarConteudo(s, ctx, mudou) {
    this.marca = campoTexto(s, 'Nome/marca na frente', 'KAPUZINHO'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    aoMudar([this.marca], mudou);
    texto(s, 'Use PETG (dobra sem quebrar). Dobre as paredes pra cima nos vincos e as abas pra dentro; uma gota de cola nas abas deixa firme.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_CX.splice(0, K_CX.length, ...sliders(this, raiz, mudou, ['Caixa', ['largura', 'Largura', 80, { min: 30, max: 150, passo: 1 }], ['profundidade', 'Profundidade', 60, { min: 30, max: 150, passo: 1 }],
      ['altura', 'Altura', 40, { min: 15, max: 100, passo: 1 }], ['espessura', 'Espessura', 1.6, { min: 1, max: 3, passo: 0.1 }], ['vinco', 'Espessura no vinco', 0.4, { min: 0.2, max: 0.8, passo: 0.05 }],
      ['aba', 'Largura das abas', 12, { min: 0, max: 30, passo: 0.5 }], 'Tampa', ['folgaTampa', 'Folga da tampa', 0.4, { min: 0.1, max: 1, passo: 0.05 }], ['saiaTampa', 'Altura da tampa', 8, { min: 3, max: 30, passo: 0.5 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_CX), mesa: Math.min(ctx.mesa.x, ctx.mesa.y) - 20 }, r = G.geoCaixaDobravel(await txt(this.fonte(), this.marca()), p);
    const bb = r.rede.bounds(), ok = bb.max[0] - bb.min[0] <= ctx.mesa.x - 10 && bb.max[1] - bb.min[1] <= ctx.mesa.y - 10;
    return resultado(ctx, r.montado, r.imprimir, `Caixa ${p.largura} × ${p.profundidade} × ${p.altura} mm (aberta: ${(bb.max[0] - bb.min[0]).toFixed(0)} × ${(bb.max[1] - bb.min[1]).toFixed(0)} mm).` + (ok ? '' : ' ⚠ Aberta, ela não cabe na mesa: diminua.'));
  },
});

// ================= 8. Vaso =================
const K_VA = [];
export const vaso = modelo({
  id: 'vaso', nome: 'Vaso Paramétrico',
  descricao: 'Vaso com ondas ou pontas, torção e barriga ajustáveis. No "modo vaso" sai maciço pra imprimir em espiral (parede única) no Bambu — rápido e bonito.',
  partes: [{ id: 'vaso', nome: 'Vaso', cor: 0x2fa58a }],
  dica2D: 'Vista de cima (o desenho da boca).',
  montarConteudo(s, ctx, mudou) {
    this.estilo = escolha(s, 'Estilo', [['ondas', 'Ondas'], ['estrela', 'Pontas (estrela)']], 'ondas');
    this.modoVaso = marcar(s, 'Pra "modo vaso" do fatiador (sai maciço)', true, { dica: 'No Bambu: Outros → Modo vaso espiral. Desmarque pra sair oco com parede.' });
    this.modoVaso.input.addEventListener('change', mudou);
    aoMudar([this.estilo], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_VA.splice(0, K_VA.length, ...sliders(this, raiz, mudou, ['Forma', ['diametro', 'Diâmetro', 90, { min: 30, max: 200, passo: 1 }], ['altura', 'Altura', 150, { min: 30, max: 250, passo: 1 }],
      ['lobos', 'Ondas/pontas', 8, { min: 3, max: 24, passo: 1, un: '' }], ['ondulacao', 'Profundidade das ondas', 0.12, { min: 0, max: 0.4, passo: 0.01, un: '' }],
      ['torcao', 'Torção', 90, { min: -360, max: 360, passo: 5, un: '°' }], ['topo', 'Boca (escala)', 1.15, { min: 0.5, max: 1.8, passo: 0.01, un: '×' }], ['bojo', 'Barriga', 0.18, { min: -0.3, max: 0.6, passo: 0.01, un: '' }],
      'Se não for modo vaso', ['parede', 'Parede', 2, { min: 0.8, max: 5, passo: 0.1 }], ['fundo', 'Fundo', 2, { min: 0.8, max: 5, passo: 0.2 }]]));
  },
  async compor2D() {
    const p = { ...vals(this, K_VA), estilo: this.estilo() }, c = G.perfilVaso(p);
    return { largura: p.diametro * 1.6, altura: p.diametro * 1.6, partes: [{ id: 'vaso', poligonos: pol(c) }], dica: 'Desenho da base. Torção e barriga aparecem em 3D.' };
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_VA), estilo: this.estilo(), modoVaso: !!this.modoVaso() }, r = G.geoVaso(p);
    // no modo vaso o fatiador imprime só a casca (~0,45 mm) + fundo: o orçamento conta isso, não o volume maciço
    const volumeOrcamento = p.modoVaso ? r.partes[0][1].surfaceArea() * 0.45 / 0.75 : undefined;
    return resultado(ctx, r.partes, null, `Vaso Ø ${p.diametro} × ${p.altura} mm` + (p.modoVaso ? ' — maciço, ligue o "Modo vaso espiral" no fatiador.' : ` — oco, parede de ${p.parede} mm.`), { volumeOrcamento });
  },
});

// ================= 9. Leque lithophane =================
const K_LQ = [];
export const leque = modelo({
  id: 'leque-litofania', nome: 'Leque Lithophane (foto)',
  descricao: 'Leque de lâminas que abre e mostra a foto contra a luz. Cada lâmina é uma fatia da foto em lithophane; um pino segura todas.',
  partes: [{ id: 'lamina1', nome: 'Lâminas ímpares', cor: 0xf4f1ea }, { id: 'lamina2', nome: 'Lâminas pares', cor: 0xece5d8 }, { id: 'pino', nome: 'Pino e arruela', cor: 0x1f2328 }],
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou);
    this.inverter = marcar(s, 'Inverter claro/escuro', false); this.inverter.input.addEventListener('change', mudou);
    texto(s, 'Imprima as lâminas em branco com 100% de preenchimento. Empilhe na ordem (1, 2, 3...) no pino e prenda a arruela por cima.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_LQ.splice(0, K_LQ.length, ...sliders(this, raiz, mudou, ['Leque', ['laminas', 'Lâminas', 8, { min: 3, max: 16, passo: 1, un: '' }], ['abertura', 'Abertura', 140, { min: 60, max: 180, passo: 5, un: '°' }],
      ['raio', 'Raio', 160, { min: 80, max: 220, passo: 1 }], ['raioFoto', 'Onde começa a foto', 60, { min: 20, max: 150, passo: 1 }], ['sobreposicao', 'Sobreposição das lâminas', 3, { min: 0, max: 8, passo: 0.5, un: '°' }],
      'Lithophane', ['espMin', 'Espessura mínima (claro)', 0.8, { min: 0.4, max: 2, passo: 0.1 }], ['espMax', 'Espessura máxima (escuro)', 2.6, { min: 1.5, max: 5, passo: 0.1 }],
      ['contraste', 'Contraste', 1, { min: 0.5, max: 2.5, passo: 0.05, un: '' }], ['resolucao', 'Detalhe (ponto)', 0.6, { min: 0.3, max: 1.2, passo: 0.05, dica: 'Menor = mais detalhe (mais lento).' }],
      'Pino', ['pino', 'Diâmetro do pino', 4, { min: 2.5, max: 8, passo: 0.25 }], ['folgaPino', 'Folga do pino', 0.25, { min: 0.1, max: 0.6, passo: 0.05 }], ['espHaste', 'Espessura da haste', 2.6, { min: 1.6, max: 4, passo: 0.2 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_LQ), inverter: !!this.inverter(), mesa: Math.min(ctx.mesa.x, ctx.mesa.y) - 20 }, r = G.geoLeque(fotoOuExemplo(this), p);
    return resultado(ctx, r.montado, r.imprimir, `Leque de ${r.n} lâminas, raio ${p.raio} mm, abre ${p.abertura}°.` + (p.raio > Math.min(ctx.mesa.x, ctx.mesa.y) - 10 ? ' ⚠ A lâmina é maior que a mesa.' : '') + avisoFoto(this));
  },
});

// ================= 10. Flexi =================
const K_FX = [];
export const flexi = modelo({
  id: 'flexi', exemplo: ['arte'], nome: 'Flexi (bichinho articulado)',
  descricao: 'Transforma uma arte (bichinho, logo) num brinquedo articulado: a arte é fatiada e as fatias ficam ligadas por dobradiças impressas no lugar. Sai da mesa já mexendo.',
  partes: [{ id: 'base', nome: 'Corpo', cor: 0xe8833a }, { id: 'letras', nome: 'Detalhes', cor: 0xf4f1ea }],
  montarConteudo(s, ctx, mudou) {
    campoArte(this, s, mudou, 'Arte (SVG ou PNG) — ou escolha na Galeria');
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.argola = marcar(s, 'Com argola de chaveiro', false); this.argola.input.addEventListener('change', mudou);
    aoMudar([this.limiar], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_FX.splice(0, K_FX.length, ...sliders(this, raiz, mudou, ['Forma', ['tamanho', 'Tamanho', 90, { min: 40, max: 200, passo: 1 }], ['fatias', 'Fatias', 5, { min: 2, max: 12, passo: 1, un: '' }],
      ['borda', 'Borda', 2.5, { min: 1, max: 6, passo: 0.1 }], ['fecho', 'Suavizar contorno', 1.5, { min: 0, max: 8, passo: 0.5 }], ['relevo', 'Relevo dos detalhes', 1.2, { min: 0, max: 3, passo: 0.1 }],
      'Dobradiças', ['pino', 'Diâmetro do pino', 3.2, { min: 2.4, max: 5, passo: 0.1 }], ['folgaRadial', 'Folga do pino', 0.35, { min: 0.2, max: 0.6, passo: 0.05 }], ['folgaAxial', 'Folga lateral', 0.4, { min: 0.2, max: 0.8, passo: 0.05 }],
      ['paredeJunta', 'Parede da dobradiça', 1.4, { min: 1, max: 3, passo: 0.1 }], ['larguraJunta', 'Largura da dobradiça', 14, { min: 8, max: 30, passo: 0.5 }], ['fracaoLingua', 'Língua do meio', 0.4, { min: 0.25, max: 0.6, passo: 0.05, un: '' }],
      'Argola', ['furo', 'Furo da argola', 4, { min: 2.5, max: 8, passo: 0.25 }], ['paredeArgola', 'Parede da argola', 2.5, { min: 1.5, max: 5, passo: 0.1 }], ['sobreposicao', 'Encaixe da argola', 3, { min: 0, max: 8, passo: 0.25 }]]));
  },
  async gerar(ctx) {
    const a = arteCs(this, 'arte', this.limiar());
    if (!a) throw new Error('Envie uma arte ou escolha uma na Galeria.');
    const p = { ...vals(this, K_FX), argola: !!this.argola(), alturaTexto: 18 }, r = G.geoFlexi(a, p);
    return resultado(ctx, r.partes, null, `Flexi ${r.larg.toFixed(0)} × ${r.alt.toFixed(0)} mm, ${r.nPecas} partes ligadas por dobradiças. Imprima sem suporte e "quebre" as juntas com cuidado.`);
  },
});

// ================= 11. Quebra-cabeça de pixels =================
const K_PX = [];
export const pixelPuzzle = modelo({
  id: 'pixel-puzzle', nome: 'Quebra-cabeça de Pixels (foto)',
  descricao: 'A foto vira pixel art em 2 a 6 cores: sai uma bandeja com casinhas e as pecinhas de cada cor. É só montar seguindo o desenho (a prévia 2D é o gabarito).',
  partes: [{ id: 'bandeja', nome: 'Bandeja', cor: 0x333333 }, ...[0, 1, 2, 3, 4, 5].map(i => ({ id: `cor${i + 1}`, nome: `Cor ${i + 1}`, cor: [0x222222, 0x666666, 0x999999, 0xbbbbbb, 0xdddddd, 0xffffff][i] }))],
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou);
    texto(s, 'As cores das peças viram as cores da foto (dá pra trocar clicando). Imprima cada cor numa vez (ou no AMS) e monte pela prévia 2D.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_PX.splice(0, K_PX.length, ...sliders(this, raiz, mudou, ['Pixels', ['colunas', 'Colunas', 24, { min: 8, max: 48, passo: 1, un: '' }], ['nCores', 'Cores', 4, { min: 2, max: 6, passo: 1, un: '' }],
      ['pixel', 'Tamanho do pixel', 6, { min: 3, max: 12, passo: 0.5 }], 'Encaixe', ['folga', 'Folga da pecinha', 0.2, { min: 0.05, max: 0.5, passo: 0.05 }], ['parede', 'Paredinha', 0.8, { min: 0.4, max: 2, passo: 0.1 }],
      ['profundidade', 'Profundidade da casa', 1.6, { min: 0.8, max: 4, passo: 0.2 }], ['piso', 'Piso', 1.2, { min: 0.6, max: 3, passo: 0.2 }], ['altPeca', 'Altura da pecinha', 2.4, { min: 1.2, max: 5, passo: 0.2 }], ['borda', 'Borda', 4, { min: 2, max: 12, passo: 0.5 }]]));
  },
  quant() {
    const f = fotoOuExemplo(this), k = `${this.colunas()}|${this.nCores()}`;
    if (this._q?.foto !== f || this._q.k !== k) {
      this._q = { foto: f, k, q: G.quantizar(f, Math.round(this.nCores()), Math.round(this.colunas())) };
      this._q.q.cores.forEach((c, i) => { this.cores[`cor${i + 1}`] = c; }); this.pintarChips?.();
    }
    return this._q.q;
  },
  async compor2D() {
    const q = this.quant(), C = M().CrossSection, s = this.pixel(), W = q.cols * s, H = q.rows * s, por = q.cores.map(() => []);
    for (let j = 0; j < q.rows; j++) for (let i = 0; i < q.cols; i++) por[q.lab[j * q.cols + i]].push(C.square([s * 0.9, s * 0.9], false).translate([-W / 2 + i * s + s * 0.05, H / 2 - (j + 1) * s + s * 0.05]));
    return { largura: W + 20, altura: H + 20, partes: [{ id: 'bandeja', poligonos: pol(C.square([W + 6, H + 6], true)) }, ...por.map((l, k) => ({ id: `cor${k + 1}`, poligonos: l.length ? pol(C.union(l)) : [] }))],
      dica: `Gabarito: ${q.cols} × ${q.rows} pecinhas.` };
  },
  async gerar(ctx) {
    const q = this.quant(), p = { ...vals(this, K_PX), mesa: Math.min(ctx.mesa.x, ctx.mesa.y) - 20 }, r = G.geoPixelPuzzle(q, p);
    return resultado(ctx, r.montado, r.imprimir, `Quadro ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm, ${q.cols} × ${q.rows} pecinhas: ` + r.contagem.map((n, i) => `cor ${i + 1}: ${n}`).join(', ') + '.' + avisoFoto(this));
  },
});

// ================= 12. Dado =================
const K_DA = [];
export const dado = modelo({
  id: 'dado', exemplo: ['arte'], nome: 'Dado Personalizado',
  descricao: 'Dado com cantos arredondados e as faces que você quiser: bolinhas normais, números ou a sua arte/logo na face do 1. Marcas embutidas em outra cor.',
  partes: [{ id: 'dado', nome: 'Dado', cor: 0xf4f1ea }, { id: 'marcas', nome: 'Marcas', cor: 0xd64545 }],
  montarConteudo(s, ctx, mudou) {
    this.tipo = escolha(s, 'Faces', [['pontos', 'Bolinhas'], ['numeros', 'Números']], 'pontos');
    campoArte(this, s, mudou, 'Arte/logo na face do 1 (opcional)');
    this.textos = campoTexto(s, 'Textos nas faces (opcional)', '', { placeholder: 'ex.: SIM,NÃO,TALVEZ,DE NOVO,AGORA,AMANHÃ', dica: '6 textos separados por vírgula substituem as faces (dado de decisão/brincadeira).' });
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    aoMudar([this.tipo, this.textos], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_DA.splice(0, K_DA.length, ...sliders(this, raiz, mudou, ['Dado', ['lado', 'Tamanho', 22, { min: 12, max: 60, passo: 0.5 }], ['raio', 'Cantos arredondados', 2.5, { min: 0.5, max: 8, passo: 0.25 }],
      ['profundidade', 'Profundidade das marcas', 0.8, { min: 0.4, max: 2, passo: 0.1 }], ['ocupacao', 'Tamanho das marcas', 0.72, { min: 0.4, max: 0.9, passo: 0.01, un: '×' }]]));
  },
  async gerar(ctx) {
    const p = vals(this, K_DA), L = p.lado, k = L * p.ocupacao, faces = [];
    const textos = (this.textos() || '').split(',').map(t => t.trim());
    const fonte = await obterFonte(this.fonte());
    for (let n = 1; n <= 6; n++) {
      let cs;
      if (textos.length >= 6 && textos[n - 1]) cs = textoParaSecao(fonte, textos[n - 1], { altura: 10 });
      else if (n === 1 && this.arte) cs = arteCs(this);
      else if (this.tipo() === 'numeros') cs = textoParaSecao(fonte, String(n), { altura: 10 });
      else { faces.push(G.pips(n).scale([k, k])); continue; }
      const b = cs.bounds(), e = Math.min(k / (b.max[0] - b.min[0]), k / (b.max[1] - b.min[1]));
      faces.push(cs.scale([e, e]).translate([-(b.min[0] + b.max[0]) / 2 * e, -(b.min[1] + b.max[1]) / 2 * e]));
    }
    const r = G.geoDado(faces, p);
    return resultado(ctx, r.partes, null, `Dado de ${L} mm (opostos somam 7). Imprima apoiado numa face, sem suporte.`);
  },
});

// ================= 13. Clicker =================
const K_CL = [];
export const clicker = modelo({
  id: 'clicker', exemplo: ['arte'], nome: 'Clicker (chaveiro com tecla mecânica)',
  descricao: 'Chaveiro "fidget" no formato da sua arte, com encaixe pra um switch de teclado mecânico (padrão MX) no meio. Coloque o switch e uma tecla (keycap) e é só clicar.',
  partes: [{ id: 'corpo', nome: 'Corpo', cor: 0x1f2328 }, { id: 'arte', nome: 'Arte', cor: 0xe2bf5f }],
  montarConteudo(s, ctx, mudou) {
    campoArte(this, s, mudou);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.argola = marcar(s, 'Com argola', true); this.argola.input.addEventListener('change', mudou);
    aoMudar([this.limiar], mudou);
    texto(s, 'O switch (MX/Gateron/Outemu) entra de cima e trava na placa de 1,5 mm. Use o modelo "Keycap" pra fazer a tecla.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_CL.splice(0, K_CL.length, ...sliders(this, raiz, mudou, ['Forma', ['tamanho', 'Tamanho da arte', 40, { min: 26, max: 90, passo: 0.5 }], ['borda', 'Borda', 2.5, { min: 1, max: 6, passo: 0.1 }],
      ['altura', 'Altura', 11, { min: 9, max: 18, passo: 0.5, dica: 'O corpo do switch precisa de ~8 mm abaixo da placa.' }], ['fundo', 'Fundo', 1.6, { min: 1, max: 3, passo: 0.2 }], ['parede', 'Parede', 1.6, { min: 1, max: 3, passo: 0.1 }],
      ['relevo', 'Relevo da arte', 0.6, { min: 0.4, max: 1.5, passo: 0.1 }], ['furo', 'Furo da argola', 4, { min: 2.5, max: 8, passo: 0.25 }]]));
  },
  async gerar(ctx) {
    const a = arteCs(this, 'arte', this.limiar());
    if (!a) throw new Error('Envie uma arte ou escolha uma na Galeria.');
    const r = G.geoClicker(a, { ...vals(this, K_CL), argola: !!this.argola() });
    return resultado(ctx, r.partes, null, 'Clicker com encaixe MX (furo de 14 × 14 mm na placa de 1,5 mm).');
  },
});

// ================= 14. Keycap =================
const K_KC = [];
export const keycap = modelo({
  id: 'keycap', nome: 'Keycap (tecla com letra ou ícone)',
  descricao: 'Tecla de teclado mecânico (encaixe Cherry MX) com uma letra, número ou ícone da Galeria em relevo ou gravado. 1u, 1,5u, 2u...',
  partes: [{ id: 'keycap', nome: 'Tecla', cor: 0x1f2328 }, { id: 'legenda', nome: 'Legenda', cor: 0xf4f1ea }],
  montarConteudo(s, ctx, mudou) {
    this.letra = campoTexto(s, 'Letra/texto', 'K', { dica: 'Vazio + arte = só o ícone.' }); this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Bold.ttf', { aoMudar: mudou });
    campoArte(this, s, mudou, 'Ícone (SVG/PNG, opcional — substitui a letra)');
    this.modo = escolha(s, 'Legenda', [['relevo', 'Em relevo'], ['gravada', 'Gravada (nivelada, outra cor)']], 'gravada');
    aoMudar([this.letra, this.modo], mudou);
    texto(s, 'Imprima com a boca pra baixo. Se a haste ficar justa demais no switch, aumente a folga.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_KC.splice(0, K_KC.length, ...sliders(this, raiz, mudou, ['Tecla', ['largura', 'Largura (u)', 1, { min: 1, max: 2.75, passo: 0.25, un: 'u' }], ['altura', 'Altura', 8, { min: 6, max: 14, passo: 0.25 }],
      ['afinar', 'Afinar o topo', 1.5, { min: 0, max: 3, passo: 0.1 }], ['parede', 'Parede', 1.4, { min: 1, max: 2.5, passo: 0.1 }], ['folga', 'Folga da haste', 0.1, { min: 0, max: 0.4, passo: 0.02 }]]));
  },
  async gerar(ctx) {
    const leg = this.arte ? arteCs(this) : await txt(this.fonte(), this.letra());
    const r = G.geoKeycap(leg, { ...vals(this, K_KC), modo: this.modo() });
    return resultado(ctx, r.partes, null, `Keycap ${this.largura()}u com haste Cherry MX.`);
  },
});

// ================= 15. Enfeite giratório =================
const K_EN = [];
export const enfeite = modelo({
  id: 'enfeite-giratorio', exemplo: ['arte'], nome: 'Enfeite Giratório (Natal/festa)',
  descricao: 'Bolinha com um disco que gira dentro do aro (impresso no lugar): arte de um lado e nome/ano do outro. Ótimo pra árvore de Natal e lembrancinha.',
  partes: [{ id: 'aro', nome: 'Aro', cor: 0xd64545 }, { id: 'disco', nome: 'Disco', cor: 0xf4f1ea }, { id: 'frente', nome: 'Arte (frente)', cor: 0x2f7d4a }, { id: 'verso', nome: 'Texto (verso)', cor: 0xd64545 }],
  montarConteudo(s, ctx, mudou) {
    campoArte(this, s, mudou, 'Arte da frente (SVG/PNG ou Galeria)');
    this.verso = campoTexto(s, 'Texto do verso', 'Natal 2026'); this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    aoMudar([this.verso], mudou);
    texto(s, 'Depois de imprimir, gire o disco devagar pra soltar os pinos.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_EN.splice(0, K_EN.length, ...sliders(this, raiz, mudou, ['Enfeite', ['diametro', 'Diâmetro', 70, { min: 40, max: 140, passo: 1 }], ['aro', 'Largura do aro', 5, { min: 3, max: 12, passo: 0.5 }],
      ['espessura', 'Espessura', 4, { min: 3, max: 8, passo: 0.2 }], ['relevo', 'Relevo da arte', 0.8, { min: 0.4, max: 2, passo: 0.1 }],
      'Giro', ['folga', 'Folga disco ↔ aro', 0.6, { min: 0.3, max: 1.2, passo: 0.05 }], ['pino', 'Diâmetro do pino', 2.6, { min: 1.8, max: 4, passo: 0.1 }], ['folgaPino', 'Folga do pino', 0.35, { min: 0.2, max: 0.7, passo: 0.05 }]]));
  },
  async gerar(ctx) {
    const r = G.geoEnfeite(arteCs(this), await txt(this.fonte(), this.verso()), vals(this, K_EN));
    return resultado(ctx, r.partes, null, `Enfeite Ø ${this.diametro()} mm com disco giratório. Sai montado da mesa.`);
  },
});

// ================= 16. Quadro em relevo (foto) =================
const K_RE = [];
export const relevoFoto = modelo({
  id: 'relevo-foto', nome: 'Quadro em Relevo (foto)',
  descricao: 'A foto vira um relevo (as partes claras ficam altas). Diferente da lithophane, é pra ver com luz de frente, como uma escultura. Formato retangular ou oval, com furo pra pendurar.',
  partes: [{ id: 'quadro', nome: 'Quadro', cor: 0xe8e2d6 }],
  dica2D: 'Vista de cima. O relevo aparece em 3D.',
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou);
    this.formato = escolha(s, 'Formato', [['retangular', 'Retangular'], ['oval', 'Oval']], 'retangular');
    this.encaixe = escolha(s, 'Imagem', [['inteira', 'Mostrar inteira (não corta)'], ['preencher', 'Preencher o quadro (pode cortar)']], 'inteira');
    this.inverter = marcar(s, 'Inverter (escuro fica alto)', false); this.pendurar = marcar(s, 'Furo pra pendurar (atrás)', true);
    for (const c of [this.inverter, this.pendurar]) c.input.addEventListener('change', mudou);
    aoMudar([this.formato, this.encaixe], mudou);
  },
  montarParametros(raiz, ctx, mudou) {
    K_RE.splice(0, K_RE.length, ...sliders(this, raiz, mudou, ['Quadro', ['largura', 'Largura', 120, { min: 40, max: 230, passo: 1 }], ['altura', 'Altura', 90, { min: 40, max: 230, passo: 1 }],
      ['moldura', 'Moldura', 5, { min: 2, max: 20, passo: 0.5 }], ['raio', 'Cantos', 4, { min: 0, max: 30, passo: 0.5 }], ['espBase', 'Base', 2, { min: 1.2, max: 5, passo: 0.2 }],
      ['relevo', 'Altura do relevo', 3, { min: 0.8, max: 10, passo: 0.1 }], ['altMoldura', 'Moldura acima do relevo', 0.5, { min: 0, max: 5, passo: 0.1 }],
      ['contraste', 'Contraste', 1, { min: 0.5, max: 2.5, passo: 0.05, un: '' }], ['resolucao', 'Detalhe (ponto)', 0.5, { min: 0.25, max: 1, passo: 0.05 }]]));
  },
  async gerar(ctx) {
    const r = G.geoRelevoFoto(fotoOuExemplo(this), { ...vals(this, K_RE), encaixe: this.encaixe(), formato: this.formato(), inverter: !!this.inverter(), pendurar: !!this.pendurar() });
    return resultado(ctx, r.partes, null, `Quadro em relevo ${this.largura()} × ${this.altura()} mm. Fica lindo em filamento branco/marfim com luz de lado.` + avisoFoto(this));
  },
});

// ================= 17. Foto em cores =================
const K_FC = [];
export const fotoCores = modelo({
  id: 'foto-cores', nome: 'Foto em Cores (pintura em filamento)',
  descricao: 'A foto vira um quadro de 2 a 4 cores de filamento (como uma pintura em camadas), cada cor uma peça pro AMS. As cores das peças já vêm da foto.',
  partes: [0x2b2620, 0x857b69, 0xd9d2c5, 0xfaf6ee].map((c, i) => ({ id: `cor${i + 1}`, nome: `Cor ${i + 1}${i ? '' : ' (base)'}`, cor: c })),
  montarConteudo(s, ctx, mudou) {
    campoFoto(this, s, mudou);
    this.degraus = marcar(s, 'Relevo em degraus (cada cor mais alta)', false); this.degraus.input.addEventListener('change', mudou);
    texto(s, 'As cores das peças são as cores médias da foto: troque pelos filamentos que você tem.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_FC.splice(0, K_FC.length, ...sliders(this, raiz, mudou, ['Quadro', ['largura', 'Largura', 120, { min: 40, max: 230, passo: 1 }], ['altura', 'Altura', 90, { min: 30, max: 230, passo: 1 }],
      ['nCores', 'Cores', 4, { min: 2, max: 4, passo: 1, un: '' }], ['detalhe', 'Detalhe (ponto)', 0.6, { min: 0.3, max: 2, passo: 0.05 }],
      ['moldura', 'Borda', 3, { min: 0, max: 15, passo: 0.5 }], ['raio', 'Cantos', 3, { min: 0, max: 20, passo: 0.5 }], ['espBase', 'Base', 1.6, { min: 0.8, max: 4, passo: 0.2 }], ['relevo', 'Altura das cores', 0.6, { min: 0.2, max: 2, passo: 0.1 }]]));
  },
  async gerar(ctx) {
    const v = vals(this, K_FC), r = G.geoFotoCores(fotoOuExemplo(this), { ...v, cores: Math.round(v.nCores), degraus: !!this.degraus() });
    const chave = `${r.cores.join(',')}`;
    if (this._coresFoto !== chave) { r.cores.forEach((c, i) => { this.cores[`cor${i + 1}`] = c; }); this._coresFoto = chave; this.pintarChips?.(); }
    return resultado(ctx, r.partes, null, `Quadro ${r.W.toFixed(0)} × ${r.H.toFixed(0)} mm em ${r.cores.length} cores.` + avisoFoto(this));
  },
});

// ================= 18. QR artístico =================
const K_QR = [];
export const qrArtistico = modelo({
  id: 'qr-artistico', exemplo: ['arte'], nome: 'QR Code Artístico (com logo)',
  descricao: 'QR code bonito: pontinhos arredondados, "olhos" redondos e o seu logo no meio (o QR usa correção alta pra continuar lendo). Pode ficar em pé numa base.',
  partes: [{ id: 'placa', nome: 'Placa', cor: 0x1f2a44 }, { id: 'qr', nome: 'QR', cor: 0xf4f1ea }, { id: 'logo', nome: 'Logo', cor: 0xe2bf5f }, { id: 'base', nome: 'Base', cor: 0x1f2a44 }],
  montarConteudo(s, ctx, mudou) {
    this.link = campoTexto(s, 'Link ou texto', 'https://kapuzinho3d.com.br');
    campoArte(this, s, mudou, 'Logo no meio (opcional)');
    this.estilo = escolha(s, 'Estilo', [['arredondado', 'Arredondado'], ['pontos', 'Pontinhos'], ['quadrados', 'Quadrado (clássico)']], 'arredondado');
    this.base = marcar(s, 'Com base pra ficar em pé', true); this.base.input.addEventListener('change', mudou);
    aoMudar([this.link, this.estilo], mudou);
    texto(s, 'Teste a leitura com o celular antes de imprimir em quantidade. Logo muito grande atrapalha a leitura.');
  },
  montarParametros(raiz, ctx, mudou) {
    K_QR.splice(0, K_QR.length, ...sliders(this, raiz, mudou, ['QR', ['lado', 'Tamanho', 70, { min: 30, max: 200, passo: 1 }], ['tamLogo', 'Tamanho do logo', 0.26, { min: 0.1, max: 0.32, passo: 0.01, un: '×' }],
      ['zonaQuieta', 'Margem (módulos)', 2, { min: 1, max: 5, passo: 0.5, un: '' }], ['raio', 'Cantos', 6, { min: 0, max: 20, passo: 0.5 }], ['espessura', 'Espessura', 2.4, { min: 1.6, max: 5, passo: 0.2 }],
      ['relevo', 'Relevo', 0.8, { min: 0.4, max: 2, passo: 0.1 }], ['profBase', 'Profundidade da base', 26, { min: 14, max: 50, passo: 1 }]]));
  },
  async gerar(ctx) {
    const p = { ...vals(this, K_QR), estilo: this.estilo(), base: !!this.base() };
    const L = G.layoutQrArtistico((this.link() || '').trim(), arteCs(this), p), r = G.geoQrArtistico(L, p);
    return resultado(ctx, r.montado, r.imprimir, `QR ${p.lado} mm (${L.n} × ${L.n} módulos de ${L.modulo.toFixed(2)} mm).` + (L.modulo < 1.2 ? ' ⚠ Módulo pequeno: aumente o tamanho pro celular ler.' : ''));
  },
});

export default [lightbox, mapaEstrelas, cartaoMusica, polaroid, molduraEncaixe, bento, caixaDobravel, vaso, leque, flexi, pixelPuzzle, dado, clicker, keycap, enfeite, relevoFoto, fotoCores, qrArtistico];
