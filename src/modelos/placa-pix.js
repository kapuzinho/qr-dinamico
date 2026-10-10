import { criarEditorModelo } from './editor.js';
import { qrParaSecao, textoParaSecao, svgParaSecao, imagemParaSecao, lerImagem } from '../core/formas.js';
import { obterFonte } from '../core/fontes.js';
import { gerarPix } from '../core/pix.js';
import { geoPlacaPix, layoutPlacaPix, retArred } from './geo.js';
import { deslizante, numero, arquivo, escolha, campoTexto, el, texto, aoMudar } from '../core/ui.js';

const poligonosDe = cs => cs.toPolygons();

export default criarEditorModelo({
  id: 'placa-pix', nome: 'Placa de PIX',
  descricao: 'Placa de pagamento PIX: escolha o tipo de chave, digite a chave e o nome, e o QR Code do Pix é gerado na hora. Logo opcional. Vem com base pra ficar em pé.',
  partes: [
    { id: 'placa', nome: 'Placa', cor: 0x5a6472 },
    { id: 'borda', nome: 'Borda', cor: 0xffffff },
    { id: 'detalhes', nome: 'Detalhes (QR, nome, logo)', cor: 0x1a1a1a },
    { id: 'base', nome: 'Base de apoio', cor: 0x5a6472 },
  ],
  montarConteudo(s, ctx, mudou) {
    this.logo = null;
    this.tipoChave = escolha(s, 'Tipo de chave', [
      ['email', 'E-mail'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Telefone'], ['aleatoria', 'Chave aleatória'],
    ], 'email', { dica: 'Escolha o tipo da sua chave Pix.' });
    this.chave = campoTexto(s, 'Chave Pix', '', { placeholder: 'sua chave aqui' });
    this.valor = campoTexto(s, 'Valor (opcional)', '', { placeholder: 'deixe vazio pro cliente digitar', dica: 'Em branco = o cliente digita o valor no app na hora de pagar.' });
    this.nomeRecebedor = campoTexto(s, 'Nome do recebedor', 'Seu Nome', { dica: 'Aparece na placa e no comprovante do Pix (máx. 25).' });
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
    this.limiar.input.addEventListener('input', mudou);
    aoMudar([this.tipoChave, this.chave, this.valor, this.nomeRecebedor], mudou);
    this.limiar.input.addEventListener('input', mudou);
    texto(s, 'O QR é gerado no teu navegador. Teste a leitura no app do banco antes de imprimir.');
  },
  montarParametros(raiz, ctx, mudou) {
    this.largura = deslizante(raiz, 'Largura da placa', 70, { min: 50, max: 110, un: 'mm', aoMudar: mudou });
    this.altura = deslizante(raiz, 'Altura da placa', 95, { min: 70, max: 150, un: 'mm', aoMudar: mudou });
    this.tamQR = deslizante(raiz, 'Tamanho máx. do QR', 48, { min: 25, max: 80, un: 'mm', aoMudar: mudou, dica: 'Limite do QR. Ele diminui sozinho pra caber o logo em cima sem encostar.' });
    this.posQR = deslizante(raiz, 'Ajuste vertical (logo + QR)', 0, { min: -15, max: 15, un: 'mm', aoMudar: mudou, dica: '0 = centralizado no espaço livre. Sobe/desce o bloco logo + QR.' });
    this.espaco = deslizante(raiz, 'Espaço entre elementos', 2.5, { min: 1, max: 8, un: 'mm', aoMudar: mudou, dica: 'Distância entre logo, QR, nome e texto.' });
    this.tamLogo = deslizante(raiz, 'Tamanho do logo', 22, { min: 8, max: 45, un: 'mm', aoMudar: mudou });
    this.tamNome = deslizante(raiz, 'Largura do nome', 50, { min: 20, max: 90, un: 'mm', aoMudar: mudou });
    this.espBase = deslizante(raiz, 'Espessura da placa', 3, { min: 2, max: 6, un: 'mm', aoMudar: mudou });
    this.espBorda = deslizante(raiz, 'Relevo da borda', 1.5, { min: 0.6, max: 4, un: 'mm', aoMudar: mudou });
    this.larguraBorda = deslizante(raiz, 'Largura da borda', 3, { min: 1, max: 8, un: 'mm', aoMudar: mudou });
    this.espDet = deslizante(raiz, 'Relevo dos detalhes', 1.2, { min: 0.6, max: 3, un: 'mm', aoMudar: mudou });
    this.raio = deslizante(raiz, 'Cantos', 6, { min: 0, max: 20, un: 'mm', aoMudar: mudou });
    this.folgaBase = deslizante(raiz, 'Folga do encaixe (base)', 0.3, { min: 0.1, max: 0.8, passo: 0.05, un: 'mm', aoMudar: mudou, dica: 'Folga de cada lado da fenda. PETG: 0.3. Se ficar justo demais, aumente.' });
    this.altBase = deslizante(raiz, 'Altura da base', 15, { min: 10, max: 30, un: 'mm', aoMudar: mudou, dica: 'A fenda tem essa altura menos 3 mm de piso.' });
    this.profBase = deslizante(raiz, 'Profundidade da base', 22, { min: 14, max: 40, un: 'mm', aoMudar: mudou, dica: 'Quanto maior, mais firme a placa fica em pé.' });
  },
  pixPayload() {
    // sem chave ainda: usa uma de exemplo só pra mostrar a placa (o resumo avisa)
    const chave = (this.chave() || '').trim() || 'seuemail@exemplo.com';
    return gerarPix({ chave, nome: this.nomeRecebedor(), valor: this.valor() });
  },
  async logoCs() {
    if (!this.logo) return null;
    return this.logo.tipo === 'svg'
      ? svgParaSecao(this.logo.dado, { largura: 40, ignorarBranco: false })
      : imagemParaSecao(this.logo.dado, { limiar: this.limiar(), largura: 40 });
  },
  async formas() {
    const fonte = await obterFonte('emb:Poppins-Bold.ttf');
    const qr = qrParaSecao(this.pixPayload(), 50).cs;
    const nome = this.nomeRecebedor().trim() ? textoParaSecao(fonte, this.nomeRecebedor(), { altura: 10 }) : null;
    const txt = textoParaSecao(fonte, 'Pagamento com PIX', { altura: 7 });
    return { qr, logo: await this.logoCs(), nome, texto: txt };
  },
  parametros() {
    return { largura: this.largura(), altura: this.altura(), raio: this.raio(), espBase: this.espBase(),
      espBorda: this.espBorda(), espDetalhe: this.espDet(), larguraBorda: this.larguraBorda(),
      tamLogo: this.tamLogo(), tamQR: this.tamQR(), posQR: this.posQR(), espaco: this.espaco(),
      tamNome: this.tamNome(), altNome: 9, profBase: this.profBase(), altBase: this.altBase(), folgaBase: this.folgaBase() };
  },
  async compor2D(ctx) {
    const f = await this.formas();
    const p = this.parametros();
    const placa = retArred(p.largura, p.altura, p.raio);
    const borda = placa.subtract(retArred(p.largura - 2 * p.larguraBorda, p.altura - 2 * p.larguraBorda, Math.max(p.raio - p.larguraBorda, 1)));
    // mesmo layout do 3D, pra prévia bater com o STL
    const L = layoutPlacaPix(f, p);
    const dets = [L.logo, L.qr, L.nome, L.texto].filter(Boolean);
    return {
      largura: p.largura + 20, altura: p.altura + 20,
      partes: [
        { id: 'placa', poligonos: poligonosDe(placa) },
        { id: 'borda', poligonos: poligonosDe(borda) },
        { id: 'detalhes', poligonos: dets.flatMap(d => poligonosDe(d)) },
      ],
      dica: 'Confira o QR e os textos. Clique no quadradinho de cor de cada peça. Teste o QR no banco antes de imprimir.',
    };
  },
  async gerar(ctx) {
    const f = await this.formas();
    const r = geoPlacaPix(f, this.parametros());
    const cx = ctx.mesa.x / 2, cy = ctx.mesa.y / 2;
    return {
      partes: r.partes,
      montado: r.partes.map(([id, m]) => [id, m, [cx, cy, 0]]),
      resumo: ((this.chave() || '').trim() ? '' : '<b style="color:#e5484d">⚠ QR com chave de EXEMPLO: digite a sua chave Pix!</b><br>') + `Placa de PIX ${this.largura().toFixed(0)} × ${this.altura().toFixed(0)} × ${r.espTotal.toFixed(1)} mm, QR de ${r.ladoQR.toFixed(1)} mm. `
        + `Fenda da base: ${r.fenda.L.toFixed(1)} × ${r.fenda.E.toFixed(1)} mm, ${r.fenda.prof.toFixed(0)} mm de fundo. Teste a leitura do QR no app do banco antes de imprimir.`,
    };
  },
});
