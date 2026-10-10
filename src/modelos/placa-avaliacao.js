import { criarEditorModelo } from './editor.js';
import { qrParaSecao, textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte } from '../core/fontes.js';
import { geoPlacaAvaliacao, layoutPlacaAvaliacao, retArred } from './geo.js';
import { deslizante, numero, arquivo, campoTexto, el, texto, aoMudar, secao, marcar } from '../core/ui.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);
const LINK_EXEMPLO = 'https://g.page/r/SEU-LINK/review';

export default criarEditorModelo({
  id: 'placa-avaliacao', nome: 'Placa de Avaliação (Google)',
  descricao: 'Placa "avalie no Google": cole o link da página de avaliação e o QR Code é gerado na hora. Tem um bolsão redondo pra embutir uma tag NFC durante a impressão (o resumo mostra a camada da pausa). Vem com base pra ficar em pé.',
  partes: [
    { id: 'placa', nome: 'Placa (fundo)', cor: 0xf2f2f2 },
    { id: 'borda', nome: 'Borda', cor: 0x1f6fd1 },
    { id: 'faixa', nome: 'Faixa de cima', cor: 0x1f6fd1 },
    { id: 'claros', nome: 'Título + círculo do logo', cor: 0xf2f2f2 },
    { id: 'estrelas', nome: 'Estrelas', cor: 0xf5c518 },
    { id: 'logo', nome: 'Logo', cor: 0x1a1a1a },
    { id: 'detalhes', nome: 'QR, NFC e textos', cor: 0x1a1a1a },
    { id: 'base', nome: 'Base de apoio', cor: 0x1f6fd1 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.logo = null;
    this.link = campoTexto(s, 'Link da avaliação', '', { placeholder: LINK_EXEMPLO, dica: 'No Perfil da Empresa no Google: "Pedir avaliações" → copiar link. Esse mesmo link vai gravado na tag NFC.' });
    this.titulo1 = campoTexto(s, 'Título (linha 1)', 'NÓS GOSTARÍAMOS DA');
    this.titulo2 = campoTexto(s, 'Título (linha 2)', 'SUA OPINIÃO NO GOOGLE');
    this.rotuloNFC = campoTexto(s, 'Texto acima do NFC', 'APROXIME SEU CELULAR');
    this.rotuloQR = campoTexto(s, 'Texto acima do QR', 'QR CODE');
    this.codigo = campoTexto(s, 'Texto abaixo do QR (opcional)', '', { placeholder: 'ex.: código da loja' });
    this.rodape = campoTexto(s, 'Rodapé', 'SUA AVALIAÇÃO FAZ A DIFERENÇA');
    this.nEstrelas = numero(s, 'Estrelas', 5, { passo: 1, min: 0, max: 7 });
    const mini = el('img', { class: 'miniatura', alt: 'Logo' }); mini.hidden = true;
    const campoArq = arquivo(s, 'Logo (SVG ou PNG, opcional)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      if (/\.svg$/i.test(f.name)) this.logo = { tipo: 'svg', dado: await f.text() };
      else this.logo = { tipo: 'img', dado: await lerImagem(f, 800) };
      mini.src = URL.createObjectURL(f); mini.hidden = false; btnLimpar.hidden = false; mudou();
    });
    const btnLimpar = el('button', { class: 'btn-mini', type: 'button', text: 'Remover logo' }); btnLimpar.hidden = true;
    btnLimpar.addEventListener('click', () => { this.logo = null; mini.hidden = true; mini.src = ''; btnLimpar.hidden = true; try { campoArq.value = ''; } catch {} mudou(); });
    s.append(mini); s.append(btnLimpar);
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    aoMudar([this.link, this.titulo1, this.titulo2, this.rotuloNFC, this.rotuloQR, this.codigo, this.rodape, this.nEstrelas, this.limiar], mudou);
    texto(s, 'O logo fica num círculo claro em cima da onda. Teste o QR e a tag NFC no celular antes de entregar.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sp = secao(raiz, 'Placa');
    this.largura = d(sp, 'Largura da placa', 90, { min: 70, max: 130 });
    this.altura = d(sp, 'Altura da placa', 125, { min: 90, max: 180 });
    this.raio = d(sp, 'Cantos', 6, { min: 0, max: 20 });
    this.espBase = d(sp, 'Espessura da placa', 3, { min: 2.4, max: 6, passo: 0.2, dica: 'O bolsão do NFC fica dentro dessa espessura.' });
    this.espBorda = d(sp, 'Relevo da borda', 1.6, { min: 0.6, max: 4 });
    this.larguraBorda = d(sp, 'Largura da borda', 3, { min: 1, max: 8 });
    this.espFaixa = d(sp, 'Relevo da faixa', 0.6, { min: 0.2, max: 2, passo: 0.2 });
    this.espDet = d(sp, 'Relevo dos detalhes', 1, { min: 0.4, max: 3, passo: 0.2 });

    const sl = secao(raiz, 'Layout');
    this.tamEstrela = d(sl, 'Tamanho das estrelas', 7, { min: 3, max: 14 });
    this.altTitulo = d(sl, 'Altura do título', 6.5, { min: 3, max: 14, dica: 'Altura máxima de cada linha (diminui sozinha se não couber na largura).' });
    this.tamLogo = d(sl, 'Tamanho do logo', 26, { min: 12, max: 45 });
    this.onda = d(sl, 'Altura da onda', 3, { min: 0, max: 10 });
    this.altRotulo = d(sl, 'Altura dos textos pequenos', 3.2, { min: 2, max: 7 });
    this.tamQR = d(sl, 'Tamanho máx. do QR', 34, { min: 15, max: 60, dica: 'Diminui sozinho pra caber na coluna.' });
    this.espaco = d(sl, 'Espaço entre elementos', 2.5, { min: 1, max: 8 });

    const sn = secao(raiz, 'Tag NFC (embutida)');
    this.diamNFC = d(sn, 'Diâmetro da tag', 25, { min: 15, max: 40, dica: 'Tag redonda NTAG213/215: geralmente 25 mm.' });
    this.espNFC = d(sn, 'Espessura da tag', 1, { min: 0.2, max: 2, passo: 0.05, dica: 'Adesivo ~0,3–0,5 mm; ficha/moeda ~1 mm. Meça com paquímetro.' });
    this.folgaNFC = d(sn, 'Folga em volta da tag', 0.3, { min: 0, max: 1, passo: 0.05 });
    this.cobertura = d(sn, 'Plástico acima da tag', 0.8, { min: 0.4, max: 2, passo: 0.2, dica: 'Quanto mais fino, melhor a leitura. 0,6–1,0 mm funciona bem.' });
    this.alturaCamada = d(sn, 'Altura de camada (fatiador)', 0.2, { min: 0.08, max: 0.32, passo: 0.04, dica: 'Igual à do teu perfil, pra pausa cair na camada certa.' });
    this.primeiraCamada = d(sn, 'Primeira camada (fatiador)', 0.2, { min: 0.08, max: 0.4, passo: 0.02 });
    this.pausaNo3mf = marcar(sn, 'Pausa já pronta no .3mf', true, { dica: 'O .3mf sai como projeto da Bambu Lab A1 (placa PEI texturizada; o material você escolhe ao baixar) com a pausa e as cores já definidas. Desmarque pra exportar só as peças (aí a pausa é manual).' });

    const sb = secao(raiz, 'Base de apoio');
    this.folgaBase = d(sb, 'Folga do encaixe (base)', 0.3, { min: 0.1, max: 0.8, passo: 0.05, dica: 'Folga de cada lado da fenda. PETG: 0.3.' });
    this.altBase = d(sb, 'Altura da base', 15, { min: 10, max: 30, dica: 'A fenda tem essa altura menos 3 mm de piso.' });
    this.profBase = d(sb, 'Profundidade da base', 24, { min: 14, max: 40 });
  },
  linkQR() { return (this.link() || '').trim() || LINK_EXEMPLO; },
  async logoCs() {
    if (!this.logo) return null;
    return this.logo.tipo === 'svg'
      ? svgParaSecao(this.logo.dado, { largura: 40, ignorarBranco: true })
      : imagemParaSecao(this.logo.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() {
    const forte = await obterFonte('emb:Poppins-Black.ttf');
    const bold = await obterFonte('emb:Poppins-Bold.ttf');
    const t = (f, v, h = 10) => (v || '').trim() ? textoParaSecao(f, v.trim(), { altura: h }) : null;
    return {
      qr: qrParaSecao(this.linkQR(), 50).cs,
      logo: await this.logoCs(),
      titulo1: t(forte, this.titulo1()), titulo2: t(forte, this.titulo2()),
      rotuloNFC: t(bold, this.rotuloNFC()), rotuloQR: t(bold, this.rotuloQR()),
      codigo: t(bold, this.codigo()), rodape: t(bold, this.rodape()),
      nfcTxt: t(forte, 'NFC'),
    };
  },
  parametros() {
    const k = ['largura', 'altura', 'raio', 'espBase', 'espBorda', 'larguraBorda', 'espFaixa', 'tamEstrela', 'altTitulo', 'tamLogo',
      'onda', 'altRotulo', 'tamQR', 'espaco', 'diamNFC', 'espNFC', 'folgaNFC', 'cobertura', 'alturaCamada', 'primeiraCamada',
      'folgaBase', 'altBase', 'profBase'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.espDetalhe = this.espDet();
    p.nEstrelas = Math.max(0, Math.min(7, Math.round(this.nEstrelas() || 0)));
    return p;
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const L = layoutPlacaAvaliacao(f, p);
    const placa = retArred(p.largura, p.altura, p.raio);
    const claros = [L.disco, L.titulos].filter(Boolean);
    return {
      largura: p.largura + 20, altura: p.altura + 20,
      partes: [
        { id: 'placa', poligonos: poligonosDe(placa) },
        { id: 'borda', poligonos: poligonosDe(placa.subtract(L.interno)) },
        { id: 'faixa', poligonos: poligonosDe(L.faixa) },
        { id: 'claros', poligonos: claros.flatMap(poligonosDe) },
        { id: 'estrelas', poligonos: poligonosDe(L.estrelas) },
        { id: 'logo', poligonos: poligonosDe(L.logo) },
        { id: 'detalhes', poligonos: poligonosDe(L.detalhes) },
      ],
      dica: (this.link() || '').trim()
        ? 'Confira o layout. O anel desenhado marca onde a tag NFC fica embutida.'
        : '⚠ Cole o link da avaliação. Por enquanto o QR está com um link de exemplo.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPlacaAvaliacao(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    const n = r.nfc, v = x => x.toFixed(2).replace('.', ',');
    const aviso = (this.link() || '').trim() ? '' : '<b style="color:#e5484d">⚠ QR com link de exemplo, cole o seu link!</b><br>';
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      pausas: this.pausaNo3mf() ? [{ z: n.zPausa, msg: 'Coloque a tag NFC no bolsão' }] : null,
      camadas: { alturaCamada: this.alturaCamada(), primeiraCamada: this.primeiraCamada() },
      resumo: aviso
        + `Placa ${this.largura().toFixed(0)} × ${this.altura().toFixed(0)} × ${v(r.espTotal)} mm, QR de ${v(r.ladoQR)} mm.<br>`
        + `<b>NFC:</b> bolsão Ø ${v(n.dFuro)} mm de ${v(n.zFundo)} a ${v(n.zTopo)} mm. `
        + (this.pausaNo3mf()
          ? `<b>Pausa já incluída no .3mf: camada ${n.camada} (${v(n.zPausa)} mm).</b> Abra no Bambu Studio como projeto (impressora A1, camada ${v(this.alturaCamada())} mm); se trocar a altura de camada no Bambu, ajuste aqui também e exporte de novo.<br>`
          : `<b>Pausa: camada ${n.camada} (${v(n.zPausa)} mm)</b>. No Bambu Studio, depois de fatiar, leve o slider de camadas até ${v(n.zPausa)} mm, clique com o botão direito no "+" e escolha "Adicionar pausa".<br>`)
        + `Fenda da base: ${v(r.fenda.L)} × ${v(r.fenda.E)} mm.`,
    };
  },
});
