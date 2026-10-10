import { criarEditorModelo } from './editor.js';
import { textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem, qrParaSecao } from '../core/formas.js';
import { obterFonte, seletorFonte } from '../core/fontes.js';
import { geoTagPet, layoutTagPet } from './geo.js';
import { deslizante, numero, arquivo, escolha, marcar, campoTexto, texto, aoMudar, secao } from '../core/ui.js';
import { M } from '../core/motor.js';

const poligonosDe = cs => (cs ? cs.toPolygons() : []);

export default criarEditorModelo({
  id: 'tag-pet', exemplo: ['arte'], nome: 'Tag de Pet (NFC)',
  descricao: 'Plaquinha de coleira: nome + arte, só a arte ou só o nome, no formato da arte, do texto, do conjunto ou redonda. Tem bolsão pra tag NFC (com pausa no .3mf) e telefone nivelado no verso.',
  partes: [
    { id: 'base', nome: 'Corpo', cor: 0x2b6cb0 },
    { id: 'texto', nome: 'Nome', cor: 0xffffff },
    { id: 'arte', nome: 'Arte', cor: 0xffffff },
    { id: 'verso', nome: 'Texto do verso', cor: 0xffffff },
  ],
  montarConteudo(s, ctx, mudou) {
    this.arte = null;
    this.conteudo = escolha(s, 'Conteúdo da frente', [['ambos', 'Nome + arte'], ['arte', 'Só a arte'], ['texto', 'Só o nome']], 'ambos');
    this.nomePet = campoTexto(s, 'Nome do pet', 'Thor');
    this.fonte = seletorFonte(s, 'Fonte', 'emb:Pacifico-Regular.ttf', { aoMudar: mudou });
    arquivo(s, 'Arte (SVG ou PNG)', '.svg,.png,.jpg,.jpeg,.webp', async f => {
      this.arte = /\.svg$/i.test(f.name) ? { tipo: 'svg', dado: await f.text() } : { tipo: 'img', dado: await lerImagem(f, 800) };
      mudou();
    }, { dica: 'Ex.: uma patinha, um osso, o rosto do pet.', aoRemover: () => { this.arte = null; mudou(); } });
    this.limiar = numero(s, 'Limiar (só PNG)', 128, { passo: 1, min: 1, max: 254 });
    this.forma = escolha(s, 'Formato da tag', [['conjunto', 'Contorno do nome + arte'], ['arte', 'Formato da arte'], ['texto', 'Formato do nome'], ['circulo', 'Redonda']], 'conjunto',
      { dica: 'No "Formato da arte", o nome fica por cima da arte (cortado se passar da borda).' });
    this.acabamento = escolha(s, 'Acabamento', [['relevo', 'Em relevo'], ['rente', 'Rente ao corpo']], 'relevo');
    this.tipoVerso = escolha(s, 'Verso', [['texto', 'Telefone/texto'], ['qr', 'QR code'], ['ambos', 'QR + telefone'], ['nada', 'Nada']], 'texto',
      { dica: 'O QR (no verso, nivelado) abre o link/WhatsApp do tutor em qualquer celular, mesmo sem NFC. Use formato Redondo e tag de uns 40 mm.' });
    this.versoTxt = campoTexto(s, 'Texto do verso (telefone)', '(61) 99999-9999', { dica: 'Fica nivelado no fundo da tag, lido certo olhando por trás.' });
    this.qrLink = campoTexto(s, 'Link do QR', 'https://wa.me/5561999999999', { dica: 'WhatsApp: https://wa.me/55 + DDD + número. Ou um link com os dados do pet.' });
    aoMudar([this.conteudo, this.nomePet, this.limiar, this.forma, this.acabamento, this.versoTxt, this.tipoVerso, this.qrLink], mudou);
    texto(s, 'Grave o telefone/link do tutor na tag NFC pelo celular (app NFC Tools) antes de embutir.');
  },
  montarParametros(raiz, ctx, mudou) {
    const d = (r, rot, v, o) => deslizante(r, rot, v, { aoMudar: mudou, un: 'mm', ...o });
    const sf = secao(raiz, 'Frente');
    this.tamArte = d(sf, 'Tamanho da arte', 28, { min: 6, max: 60, passo: 0.5 });
    this.rotArte = deslizante(sf, 'Rotação da arte', 0, { min: -180, max: 180, passo: 1, un: '°', aoMudar: mudou });
    this.alturaTexto = d(sf, 'Altura do nome', 10, { min: 3, max: 30, passo: 0.5 });
    this.larguraTexto = d(sf, 'Largura máx. do nome', 38, { min: 10, max: 80, passo: 0.5 });
    this.espaco = d(sf, 'Espaço arte ↔ nome', 1.5, { min: 0, max: 8, passo: 0.25 });
    this.textoY = d(sf, 'Ajuste vertical do nome', 0, { min: -20, max: 20, passo: 0.5 });
    this.engrossar = d(sf, 'Engrossar nome', 0.2, { min: 0, max: 1.5, passo: 0.05 });
    this.relevo = d(sf, 'Relevo', 1, { min: 0.4, max: 3, passo: 0.1 });

    const sc = secao(raiz, 'Corpo');
    this.borda = d(sc, 'Borda', 2.5, { min: 1, max: 8, passo: 0.1 });
    this.fecho = d(sc, 'Suavizar contorno', 1.5, { min: 0, max: 12, passo: 0.5 });
    this.folgaCirculo = deslizante(sc, 'Folga (redonda)', 1, { min: 0.7, max: 1.4, passo: 0.02, aoMudar: mudou, dica: 'Só no formato redondo: < 1 aperta, > 1 sobra borda.' });
    this.espBase = d(sc, 'Espessura mínima', 3.2, { min: 2, max: 8, passo: 0.2, dica: 'Aumenta sozinha se a tag NFC precisar.' });

    const sn = secao(raiz, 'Tag NFC (embutida, com pausa)');
    this.nfc = marcar(sn, 'Com bolsão pra tag NFC', true);
    this.diamNFC = d(sn, 'Diâmetro da tag', 15, { min: 8, max: 35, passo: 0.5, dica: 'Tag redonda adesiva NTAG213/215 (pra pet, 15 ou 20 mm; meça a sua).' });
    this.espNFC = d(sn, 'Espessura da tag', 0.6, { min: 0.2, max: 2, passo: 0.05 });
    this.folgaNFC = d(sn, 'Folga em volta', 0.3, { min: 0, max: 1, passo: 0.05 });
    this.pisoNFC = d(sn, 'Plástico embaixo da tag', 0.8, { min: 0.4, max: 3, passo: 0.2 });
    this.coberturaNFC = d(sn, 'Plástico em cima da tag', 0.8, { min: 0.4, max: 3, passo: 0.2, dica: 'Fino = leitura melhor. 0,6–1,0 mm.' });
    this.margemNFC = d(sn, 'Distância mínima da borda', 1.2, { min: 0.6, max: 5, passo: 0.1 });
    this.nfcX = d(sn, 'Mover bolsão (horizontal)', 0, { min: -30, max: 30, passo: 0.5 });
    this.nfcY = d(sn, 'Mover bolsão (vertical)', 0, { min: -30, max: 30, passo: 0.5 });
    this.alturaCamada = d(sn, 'Altura de camada (fatiador)', 0.2, { min: 0.08, max: 0.32, passo: 0.04 });
    this.primeiraCamada = d(sn, 'Primeira camada (fatiador)', 0.2, { min: 0.08, max: 0.4, passo: 0.02 });
    this.pausaNo3mf = marcar(sn, 'Pausa já pronta no .3mf', true, { dica: 'O .3mf sai como projeto da Bambu Lab A1 com a pausa e as cores definidas.' });

    const sv = secao(raiz, 'Verso');
    this.alturaVerso = d(sv, 'Altura do texto do verso', 6, { min: 2, max: 20, passo: 0.5 });
    this.profVerso = d(sv, 'Profundidade do verso', 0.6, { min: 0.2, max: 1.2, passo: 0.2 });
    this.versoY = d(sv, 'Ajuste vertical do verso', 0, { min: -20, max: 20, passo: 0.5 });

    const sg = secao(raiz, 'Argola');
    this.argola = marcar(sg, 'Com argola', true);
    this.anguloArgola = deslizante(sg, 'Lado da argola', 90, { min: 0, max: 360, passo: 5, un: '°', aoMudar: mudou });
    this.deslocArgola = d(sg, 'Deslocar ao longo da borda', 0, { min: -40, max: 40, passo: 0.5 });
    this.furo = d(sg, 'Diâmetro do furo', 4.5, { min: 2, max: 10, passo: 0.25, dica: 'Pra argolinha de coleira: 4–5 mm.' });
    this.paredeArgola = d(sg, 'Parede da argola', 2.5, { min: 1.2, max: 5, passo: 0.1 });
    this.sobreposicao = d(sg, 'Encaixe no contorno', 2.5, { min: 0, max: 8, passo: 0.25 });
  },
  async formas() {
    const c = this.conteudo(), fonte = await obterFonte(this.fonte());
    const nome = (this.nomePet() || '').trim(), vs = (this.versoTxt() || '').trim();
    let arte = null;
    if (c !== 'texto' && this.arte) arte = this.arte.tipo === 'svg' ? svgParaSecao(this.arte.dado, { largura: 30, ignorarBranco: true }) : imagemParaSecao(this.arte.dado, { limiar: this.limiar(), largura: 30 });
    const texto = c !== 'arte' && nome ? textoParaSecao(fonte, nome, { altura: 10 }) : null;
    const tv = this.tipoVerso();
    let verso = (tv === 'texto' || tv === 'ambos') && vs ? textoParaSecao(await obterFonte('emb:Poppins-Bold.ttf'), vs, { altura: 10 }) : null;
    const link = (this.qrLink() || '').trim();
    if ((tv === 'qr' || tv === 'ambos') && link) {
      const qr = qrParaSecao(link, 50).cs;
      if (verso) {   // QR em cima, telefone embaixo
        const qb = qr.bounds(), vb = verso.bounds(), k = (qb.max[0] - qb.min[0]) * 0.9 / (vb.max[0] - vb.min[0]);
        const t = verso.scale([k, k]), tb = t.bounds();
        verso = qr.add(t.translate([(qb.min[0] + qb.max[0]) / 2 - (tb.min[0] + tb.max[0]) / 2, qb.min[1] - 3 - tb.max[1]]));
      } else verso = qr;
    }
    if (!arte && !texto) throw new Error(c === 'arte' ? 'Envie a arte (SVG ou PNG).' : 'Digite o nome do pet.');
    return { arte, texto, verso };
  },
  parametros() {
    const k = ['tamArte', 'rotArte', 'alturaTexto', 'larguraTexto', 'espaco', 'textoY', 'engrossar', 'relevo', 'borda', 'fecho', 'folgaCirculo', 'espBase',
      'diamNFC', 'espNFC', 'folgaNFC', 'pisoNFC', 'coberturaNFC', 'margemNFC', 'nfcX', 'nfcY', 'alturaCamada', 'primeiraCamada',
      'alturaVerso', 'profVerso', 'versoY', 'anguloArgola', 'deslocArgola', 'furo', 'paredeArgola', 'sobreposicao'];
    const p = Object.fromEntries(k.map(n => [n, this[n]()]));
    p.nfc = !!this.nfc(); p.argola = !!this.argola(); p.versoGrande = this.tipoVerso() === 'qr' || this.tipoVerso() === 'ambos'; p.forma = this.forma(); p.acabamento = this.acabamento();
    return p;
  },
  async compor2D(ctx) {
    const p = this.parametros();
    const L = layoutTagPet(await this.formas(), p);
    const C = M().CrossSection;
    const esc = (c, k) => [16, 8, 0].reduce((n, s) => n | (Math.round(((c >> s) & 255) * k) << s), 0);
    this.cores.nfc = esc(this.cores.base, 0.6);
    const partes = [{ id: 'base', poligonos: poligonosDe(L.base) }];
    if (L.nfc && !L.nfc.semEspaco) partes.push({ id: 'nfc', poligonos: poligonosDe(C.circle(L.nfc.r, 64).translate([L.nfc.x, L.nfc.y]).subtract(C.circle(L.nfc.r - 0.5, 64).translate([L.nfc.x, L.nfc.y]))) });
    if (L.texto) partes.push({ id: 'texto', poligonos: poligonosDe(L.texto) });
    if (L.arte) partes.push({ id: 'arte', poligonos: poligonosDe(L.arte) });
    const av = [];
    if (L.nfc?.semEspaco) av.push('⚠ A tag NFC não cabe nesse formato: aumente o tamanho ou use uma tag menor.');
    else if (L.nfc?.ajustado) av.push('O bolsão do NFC foi empurrado pra dentro da peça.');
    return {
      largura: L.larg + 20, altura: L.alt + 20, partes,
      dica: `Tag ${L.larg.toFixed(0)} × ${L.alt.toFixed(0)} mm. O anel escuro marca onde fica a tag NFC.` + (L.verso ? ' O verso aparece no 3D.' : '') + ' ' + av.join(' '),
    };
  },
  async gerar(ctx) {
    const p = this.parametros();
    const r = geoTagPet(await this.formas(), p);
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    const v = x => x.toFixed(2).replace('.', ','), b = r.bolsao;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      pausas: b && this.pausaNo3mf() ? [{ z: b.zPausa, msg: 'Coloque a tag NFC no bolsão' }] : null,
      camadas: { alturaCamada: p.alturaCamada, primeiraCamada: p.primeiraCamada },
      resumo: `Tag ${r.L.larg.toFixed(0)} × ${r.L.alt.toFixed(0)} × ${v(r.alturaTotal)} mm (corpo de ${v(r.espBase)} mm).`
        + (r.L.nfc?.semEspaco ? '<br><b style="color:#e5484d">⚠ A tag NFC não coube nesse formato: a peça saiu sem o bolsão. Aumente a tag de pet ou use uma tag NFC menor.</b>' : '') + (b ? `<br><b>NFC:</b> bolsão Ø ${v(r.L.nfc.r * 2)} mm de ${v(b.zFundo)} a ${v(b.zTopo)} mm. <b>Pausa na camada ${b.camada} (${v(b.zPausa)} mm)</b>`
          + (this.pausaNo3mf() ? ', já pronta no .3mf (abra no Bambu como projeto).' : ': adicione no Bambu (botão direito no slider → Adicionar pausa).')
          + ' Na pausa, coloque a tag no bolsão e continue.' : ''),
    };
  },
});
