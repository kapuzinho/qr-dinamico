// Placa de Avaliação Google v2 — editor (geometria em geo-google2.js)
import { criarEditorModelo } from './editor.js';
import { qrParaSecao, textoParaSecao } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { deslizante, numero, escolha, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { retArred } from './geo.js';
import { layoutGoogle2, geoPlacaGoogle2, iconeNFC, caber } from './geo-google2.js';
const pol = cs => (cs ? cs.toPolygons() : []);

// ---------- editor ----------
const LINK_EXEMPLO = 'https://g.page/r/SEU-LINK/review';
const K = [];
export default criarEditorModelo({
  id: 'placa-google-v2', nome: 'Placa Avaliação Google v2 (QR + NFC encaixe)',
  descricao: 'Placa quadrada "Avalie-nos no Google" com área branca em onda e dois quadrados de encaixe: um com o QR Code gerado pelo seu link (do tamanho certinho do quadrado) e outro com o desenho do NFC e o rebaixo da tag atrás. G do Google em 4 cores (encaixe separado ou junto na placa) e suporte de apoio que encaixa atrás.',
  partes: [
    { id: 'placa', nome: 'Placa (base)', cor: 0xffffff },
    { id: 'faixa', nome: 'Camada de cima (azul)', cor: 0x0050c8 },
    { id: 'claros', nome: 'Área branca + círculo + molduras', cor: 0xffffff },
    { id: 'texto', nome: 'Texto', cor: 0xffffff },
    { id: 'estrelas', nome: 'Estrelas', cor: 0xffd60a },
    { id: 'gVermelho', nome: 'G – vermelho', cor: 0xd0021b },
    { id: 'gAmarelo', nome: 'G – amarelo', cor: 0xffd60a },
    { id: 'gVerde', nome: 'G – verde', cor: 0x00a550 },
    { id: 'gAzul', nome: 'G – azul (barra)', cor: 0x1a1a1a },
    { id: 'qrFundo', nome: 'Quadrado do QR', cor: 0xffffff },
    { id: 'qr', nome: 'QR Code', cor: 0x1a1a1a },
    { id: 'nfcFundo', nome: 'Quadrado do NFC', cor: 0xffffff },
    { id: 'nfcIcone', nome: 'Desenho do NFC', cor: 0x1a1a1a },
    { id: 'suporte', nome: 'Suporte', cor: 0xffffff },
  ],
  montarConteudo(s, ctx, mudou) {
    this.link = campoTexto(s, 'Link da avaliação', '', { placeholder: LINK_EXEMPLO, dica: 'Perfil da Empresa no Google → "Pedir avaliações" → copiar link. Grave o mesmo link na tag NFC (app NFC Tools).' });
    this.linha1 = campoTexto(s, 'Texto (linha 1)', 'AVALIE-NOS NO');
    this.linha2 = campoTexto(s, 'Texto (linha 2)', 'GOOGLE');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Poppins-Black.ttf', { aoMudar: mudou });
    this.nEstrelas = numero(s, 'Estrelas', 5, { passo: 1, min: 0, max: 7 });
    this.modoG = escolha(s, 'G do Google', [['encaixe', 'Peça separada pra encaixar (como o original)'], ['junto', 'Junto na placa (multicor)']], 'encaixe');
    this.ladoQRsel = escolha(s, 'Posição do QR', [['esq', 'QR à esquerda, NFC à direita'], ['dir', 'NFC à esquerda, QR à direita']], 'esq');
    aoMudar([this.link, this.linha1, this.linha2, this.nEstrelas, this.modoG, this.ladoQRsel], mudou);
    texto(s, 'Os quadrados saem virados na mesa (frente lisa no vidro) e o QR/desenho do NFC já embutidos na cor. Cole a tag NFC adesiva no rebaixo atrás do quadrado do NFC. Teste o QR e o NFC no celular antes de entregar.');
  },
  montarParametros(raiz, ctx, mudou) {
    let sec = null; const lista = [
      'Placa', ['largura', 'Largura', 100, { min: 80, max: 160 }], ['altura', 'Altura', 100, { min: 80, max: 160 }], ['raio', 'Cantos', 4, { min: 0, max: 15, passo: 0.5 }],
      ['espPlaca', 'Espessura da base', 5, { min: 3.6, max: 8, passo: 0.2 }], ['espFaixa', 'Camada de cima (azul)', 1.4, { min: 0.8, max: 3, passo: 0.2 }],
      ['relevoTexto', 'Relevo do texto', 0.6, { min: 0.2, max: 2, passo: 0.2 }], ['relevoEstrelas', 'Relevo das estrelas', 0.4, { min: 0, max: 2, passo: 0.2 }],
      'Layout', ['margem', 'Margem da área branca', 3.5, { min: 2, max: 8, passo: 0.5 }], ['raioArea', 'Cantos da área branca', 4, { min: 0.5, max: 10, passo: 0.5 }],
      ['altArea', 'Altura da área branca (meio da onda)', 50.5, { min: 40, max: 80, passo: 0.5 }], ['onda', 'Altura da onda', 4.2, { min: 0, max: 10, passo: 0.2 }],
      ['diamCirculo', 'Círculo do logo', 32, { min: 20, max: 50, passo: 0.5 }], ['tamG', 'Tamanho do G', 26, { min: 14, max: 46, passo: 0.5 }],
      ['altTexto', 'Altura máx. de cada linha', 6, { min: 3, max: 14, passo: 0.5, dica: 'Diminui sozinho se não couber na largura.' }],
      ['tamEstrela', 'Tamanho das estrelas', 6, { min: 3, max: 12, passo: 0.5 }], ['espaco', 'Espaço círculo → texto', 3, { min: 1, max: 10, passo: 0.5 }],
      'Quadrados (QR e NFC)', ['ladoQuadrado', 'Lado do quadrado', 30.7, { min: 20, max: 45, passo: 0.1 }], ['espQuadrado', 'Espessura do quadrado', 1, { min: 0.8, max: 2, passo: 0.2, dica: '1,0 mm fica rente com a camada azul.' }],
      ['folgaQuadrado', 'Folga do encaixe', 0.15, { min: 0, max: 0.6, passo: 0.05 }], ['margemQR', 'Margem branca do QR', 1.5, { min: 0.5, max: 5, passo: 0.1 }],
      ['profInlay', 'Profundidade do QR/desenho', 0.4, { min: 0.2, max: 0.8, passo: 0.2 }],
      ['diamTag', 'Diâmetro da tag NFC', 25, { min: 15, max: 30, passo: 0.5 }], ['espTag', 'Rebaixo da tag (atrás)', 0.4, { min: 0, max: 1, passo: 0.1, dica: 'Tag adesiva ~0,3 mm. 0 = sem rebaixo.' }],
      'G e suporte', ['folgaG', 'Folga do encaixe do G', 0.15, { min: 0, max: 0.5, passo: 0.05 }],
      ['largSuporte', 'Largura do suporte', 50, { min: 30, max: 90, passo: 1 }], ['compSuporte', 'Comprimento do suporte', 41.6, { min: 25, max: 70, passo: 0.5, dica: 'Maior = placa mais em pé.' }],
      ['espSuporte', 'Espessura do suporte', 3.9, { min: 2.4, max: 6, passo: 0.1 }], ['folgaSuporte', 'Folga do canal', 0.15, { min: 0, max: 0.5, passo: 0.05 }],
      ['profCanal', 'Profundidade do canal', 3, { min: 1.5, max: 5, passo: 0.1 }], ['alturaCanal', 'Altura do canal (da borda de baixo)', 10.1, { min: 6, max: 30, passo: 0.1 }],
    ];
    for (const it of lista) {
      if (typeof it === 'string') { sec = secao(raiz, it); continue; }
      const [k, rot, v, o] = it; this[k] = deslizante(sec, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    }
    K.splice(0, K.length, ...lista.filter(x => typeof x !== 'string').map(x => x[0]));
  },
  linkQR() { return (this.link() || '').trim() || LINK_EXEMPLO; },
  async formas() {
    const fonte = await obterFonte(this.fonte());
    const t = v => ((v || '').trim() ? textoParaSecao(fonte, v.trim(), { altura: 10 }) : null);
    const q = qrParaSecao(this.linkQR(), 50);
    return { qr: q.cs, qrModulos: q.modulos, linhas: [t(this.linha1()), t(this.linha2())], nfcTxt: textoParaSecao(await obterFonte('emb:Poppins-Black.ttf'), 'NFC', { altura: 10 }) };
  },
  parametros(ctx) {
    const p = Object.fromEntries(K.map(k => [k, this[k]()]));
    p.nEstrelas = Math.max(0, Math.min(7, Math.round(this.nEstrelas() || 0)));
    p.modoG = this.modoG(); p.qrDireita = this.ladoQRsel() === 'dir';
    p.mesa = (ctx?.mesa?.x || 256) - 10;
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas(), p = this.parametros(ctx), L = layoutGoogle2(f, p);
    const ladoQR = p.ladoQuadrado - 2 * p.margemQR, base = retArred(p.ladoQuadrado, p.ladoQuadrado, 1);
    const qr = caber(f.qr, ladoQR, ladoQR).translate([L.qr.x, L.qr.y]);
    const ico = iconeNFC(p.ladoQuadrado, f.nfcTxt).translate([L.nfc.x, L.nfc.y]);
    const ids = { vermelho: 'gVermelho', amarelo: 'gAmarelo', verde: 'gVerde', azul: 'gAzul' };
    return {
      largura: p.largura + 20, altura: p.altura + 20,
      partes: [
        { id: 'faixa', poligonos: pol(L.placa) },
        { id: 'claros', poligonos: pol(L.area.add(L.disco)) },
        { id: 'claros', poligonos: pol(L.molduras) },
        { id: 'qrFundo', poligonos: pol(base.translate([L.qr.x, L.qr.y])) },
        { id: 'qr', poligonos: pol(qr) },
        { id: 'nfcFundo', poligonos: pol(base.translate([L.nfc.x, L.nfc.y])) },
        { id: 'nfcIcone', poligonos: pol(ico) },
        { id: 'estrelas', poligonos: pol(L.estrelas) },
        { id: 'texto', poligonos: pol(L.texto) },
        ...Object.entries(L.gPartes).map(([k, cs]) => ({ id: ids[k], poligonos: pol(cs) })),
      ],
      dica: (this.link() || '').trim() ? 'Frente da placa montada. Veja em 3D pra conferir as peças.' : '⚠ Cole o link da avaliação. Por enquanto o QR está com um link de exemplo.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas(), p = this.parametros(ctx);
    const r = geoPlacaGoogle2(f, p);
    const v = x => x.toFixed(1).replace('.', ',');
    const aviso = (this.link() || '').trim() ? '' : '<b style="color:#e5484d">⚠ QR com link de exemplo, cole o seu link!</b><br>';
    const avisoMod = r.modulo < 0.8 ? `<br><b style="color:#e5484d">⚠ Quadradinhos do QR com ${v(r.modulo)} mm: link muito longo. Use o link curto (g.page/r/...) ou aumente o quadrado.</b>` : '';
    return {
      partes: r.montado, montado: r.montado.map(([id, m]) => [id, m, [ctx.mesa.x / 2, ctx.mesa.y / 2, 0]]), imprimir: r.imprimir,
      resumo: aviso + `Placa ${v(p.largura)} × ${v(p.altura)} × ${v(r.total)} mm, em pé com inclinação de ~${v(r.inclinacao)}°.<br>`
        + `QR de ${v(r.ladoQR)} mm (quadradinho de ${v(r.modulo)} mm) no quadrado de ${v(p.ladoQuadrado)} mm.`
        + (r.espTag > 0.05 ? ` Rebaixo da tag NFC: Ø ${v(p.diamTag + 0.4)} × ${r.espTag.toFixed(2).replace('.', ',')} mm atrás do quadrado.` : '')
        + `<br>Na mesa: placa, ${p.modoG === 'encaixe' ? 'G em 4 peças (encaixe no círculo), ' : ''}quadrados virados (frente no vidro) e o suporte.` + avisoMod,
    };
  },
});
